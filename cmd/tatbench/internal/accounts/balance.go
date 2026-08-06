package accounts

import (
	"encoding/json"
	"fmt"
	"os/exec"
	"strconv"
)

type balanceResponse struct {
	Balance struct {
		Denom  string `json:"denom"`
		Amount string `json:"amount"`
	} `json:"balance"`
}

func Balances(
	binary,
	home,
	prefix,
	denom string,
	start,
	count int,
) error {
	if start <= 0 {
		return fmt.Errorf("start must be greater than zero")
	}
	if count <= 0 {
		return fmt.Errorf("count must be greater than zero")
	}
	if prefix == "" {
		return fmt.Errorf("prefix cannot be empty")
	}
	if denom == "" {
		return fmt.Errorf("denom cannot be empty")
	}

	end := start + count - 1

	fmt.Println("Benchmark account balances")
	fmt.Println("--------------------------")
	fmt.Printf("Prefix: %s\n", prefix)
	fmt.Printf("Range:  %04d-%04d\n", start, end)
	fmt.Printf("Denom:  %s\n\n", denom)

	var (
		found   int
		missing int
		total   int64
	)

	for offset := 0; offset < count; offset++ {
		index := start + offset
		name := fmt.Sprintf("%s-%04d", prefix, index)

		address, err := showAddress(binary, home, name)
		if err != nil {
			missing++
			fmt.Printf("%-12s KEY NOT FOUND\n", name)
			continue
		}

		amount, err := queryBalance(binary, home, address, denom)
		if err != nil {
			return fmt.Errorf("query %s balance: %w", name, err)
		}

		value, err := strconv.ParseInt(amount, 10, 64)
		if err != nil {
			return fmt.Errorf("parse %s balance: %w", name, err)
		}

		total += value
		found++

		fmt.Printf("%-12s %-45s %s %s\n", name, address, amount, denom)
	}

	fmt.Println()
	fmt.Println("Summary")
	fmt.Println("-------")
	fmt.Printf("Found:   %d\n", found)
	fmt.Printf("Missing: %d\n", missing)
	fmt.Printf("Total:   %d %s\n", total, denom)

	return nil
}

func queryBalance(
	binary,
	home,
	address,
	denom string,
) (string, error) {
	cmd := exec.Command(
		binary,
		"query", "bank", "balance",
		address,
		denom,
		"--home", home,
		"--output", "json",
	)

	output, err := cmd.Output()
	if err != nil {
		return "", err
	}

	var response balanceResponse
	if err := json.Unmarshal(output, &response); err != nil {
		return "", fmt.Errorf("decode balance response: %w", err)
	}

	if response.Balance.Amount == "" {
		return "0", nil
	}

	return response.Balance.Amount, nil
}
