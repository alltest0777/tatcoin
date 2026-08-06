package accounts

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

type txResult struct {
	Code   uint32 `json:"code"`
	TxHash string `json:"txhash"`
	RawLog string `json:"raw_log"`
}

func Fund(
	binary,
	home,
	chainID,
	from,
	prefix,
	amount string,
	start,
	count int,
) error {
	if start <= 0 {
		return fmt.Errorf("start must be greater than zero")
	}
	if count <= 0 {
		return fmt.Errorf("count must be greater than zero")
	}

	end := start + count - 1

	fmt.Println("Fund benchmark accounts")
	fmt.Println("-----------------------")
	fmt.Printf("From:   %s\n", from)
	fmt.Printf("Prefix: %s\n", prefix)
	fmt.Printf("Range:  %04d-%04d\n", start, end)
	fmt.Printf("Count:  %d\n", count)
	fmt.Printf("Amount: %s\n\n", amount)

	success := 0
	failed := 0

	for offset := 0; offset < count; offset++ {
		index := start + offset
		name := fmt.Sprintf("%s-%04d", prefix, index)

		address, err := showAddress(binary, home, name)
		if err != nil {
			failed++
			fmt.Printf("[%d/%d] FAILED %s: %v\n", offset+1, count, name, err)
			continue
		}

		result, err := send(binary, home, chainID, from, address, amount)
		if err != nil {
			failed++
			fmt.Printf("[%d/%d] FAILED %s: %v\n", offset+1, count, name, err)
			continue
		}

		if result.Code != 0 {
			failed++
			fmt.Printf(
				"[%d/%d] FAILED %s: code=%d log=%s\n",
				offset+1,
				count,
				name,
				result.Code,
				result.RawLog,
			)
			continue
		}

		if err := waitForTx(binary, home, result.TxHash, 30*time.Second); err != nil {
			failed++
			fmt.Printf(
				"[%d/%d] FAILED %s confirmation: %v\n",
				offset+1,
				count,
				name,
				err,
			)
			continue
		}

		success++
		fmt.Printf(
			"[%d/%d] FUNDED %s %s tx=%s\n",
			offset+1,
			count,
			name,
			address,
			result.TxHash,
		)
	}

	fmt.Println()
	fmt.Println("Summary")
	fmt.Println("-------")
	fmt.Printf("Funded: %d\n", success)
	fmt.Printf("Failed: %d\n", failed)

	if failed > 0 {
		return fmt.Errorf("%d account(s) failed", failed)
	}

	return nil
}

func showAddress(binary, home, name string) (string, error) {
	cmd := exec.Command(
		binary,
		"keys", "show", name,
		"--address",
		"--keyring-backend", "test",
		"--home", home,
	)

	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("key not found")
	}

	return strings.TrimSpace(string(output)), nil
}

func send(
	binary,
	home,
	chainID,
	from,
	to,
	amount string,
) (*txResult, error) {
	args := []string{
		"tx", "bank", "send",
		from,
		to,
		amount,
		"--from", from,
		"--chain-id", chainID,
		"--keyring-backend", "test",
		"--gas", "auto",
		"--gas-adjustment", "1.4",
		"--gas-prices", "0.025utat",
		"--broadcast-mode", "sync",
		"--home", home,
		"--output", "json",
		"-y",
	}

	cmd := exec.Command(binary, args...)

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("%w: %s", err, strings.TrimSpace(stderr.String()))
	}

	var result txResult
	if err := json.Unmarshal(output, &result); err != nil {
		return nil, fmt.Errorf("decode transaction result: %w", err)
	}

	return &result, nil
}

func waitForTx(binary, home, txHash string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)

	for time.Now().Before(deadline) {
		cmd := exec.Command(
			binary,
			"query", "tx", txHash,
			"--home", home,
			"--output", "json",
		)

		output, err := cmd.Output()
		if err == nil {
			var result txResult
			if err := json.Unmarshal(output, &result); err != nil {
				return fmt.Errorf("decode tx result: %w", err)
			}

			if result.Code != 0 {
				return fmt.Errorf(
					"transaction failed: code=%d log=%s",
					result.Code,
					result.RawLog,
				)
			}

			return nil
		}

		time.Sleep(500 * time.Millisecond)
	}

	return fmt.Errorf("timeout waiting for transaction %s", txHash)
}
