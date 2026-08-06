package accounts

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
)

type keyOutput struct {
	Name    string `json:"name"`
	Address string `json:"address"`
}

func Create(binary, home, prefix string, count int) error {
	if count <= 0 {
		return fmt.Errorf("count must be greater than zero")
	}

	fmt.Println("Create benchmark accounts")
	fmt.Println("-------------------------")
	fmt.Printf("Prefix: %s\n", prefix)
	fmt.Printf("Count:  %d\n\n", count)

	for i := 1; i <= count; i++ {
		name := fmt.Sprintf("%s-%04d", prefix, i)

		address, created, err := createOne(binary, home, name)
		if err != nil {
			return fmt.Errorf("create %s: %w", name, err)
		}

		if created {
			fmt.Printf("[%d/%d] CREATED %s %s\n", i, count, name, address)
		} else {
			fmt.Printf("[%d/%d] EXISTS  %s %s\n", i, count, name, address)
		}
	}

	return nil
}

func createOne(binary, home, name string) (address string, created bool, err error) {
	showCmd := exec.Command(
		binary,
		"keys", "show", name,
		"--address",
		"--keyring-backend", "test",
		"--home", home,
	)

	if output, showErr := showCmd.Output(); showErr == nil {
		return strings.TrimSpace(string(output)), false, nil
	}

	cmd := exec.Command(
		binary,
		"keys", "add", name,
		"--keyring-backend", "test",
		"--home", home,
		"--output", "json",
	)

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	output, err := cmd.Output()
	if err != nil {
		return "", false, fmt.Errorf("%w: %s", err, strings.TrimSpace(stderr.String()))
	}

	var result keyOutput
	if err := json.Unmarshal(output, &result); err != nil {
		return "", false, fmt.Errorf("decode key output: %w", err)
	}

	return result.Address, true, nil
}
