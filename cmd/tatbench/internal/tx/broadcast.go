package tx

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
)

func broadcast(
	binary,
	home,
	chainID,
	from,
	to,
	amount string,
) (*broadcastResult, error) {
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
		return nil, fmt.Errorf(
			"%w: %s",
			err,
			strings.TrimSpace(stderr.String()),
		)
	}

	var result broadcastResult
	if err := json.Unmarshal(output, &result); err != nil {
		return nil, fmt.Errorf("decode broadcast result: %w", err)
	}

	return &result, nil
}
