package accounts

import (
	"bytes"
	"fmt"
	"os/exec"
	"strings"
)

func Delete(
	binary,
	home,
	prefix string,
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

	end := start + count - 1

	fmt.Println("Delete benchmark accounts")
	fmt.Println("-------------------------")
	fmt.Printf("Prefix: %s\n", prefix)
	fmt.Printf("Range:  %04d-%04d\n\n", start, end)

	deleted := 0
	missing := 0
	failed := 0

	for offset := 0; offset < count; offset++ {
		index := start + offset
		name := fmt.Sprintf("%s-%04d", prefix, index)

		if _, err := showAddress(binary, home, name); err != nil {
			missing++
			fmt.Printf("[%d/%d] MISSING %s\n", offset+1, count, name)
			continue
		}

		cmd := exec.Command(
			binary,
			"keys", "delete", name,
			"--keyring-backend", "test",
			"--home", home,
			"-y",
		)

		var stderr bytes.Buffer
		cmd.Stderr = &stderr

		if err := cmd.Run(); err != nil {
			failed++
			fmt.Printf(
				"[%d/%d] FAILED %s: %s\n",
				offset+1,
				count,
				name,
				strings.TrimSpace(stderr.String()),
			)
			continue
		}

		deleted++
		fmt.Printf("[%d/%d] DELETED %s\n", offset+1, count, name)
	}

	fmt.Println()
	fmt.Println("Summary")
	fmt.Println("-------")
	fmt.Printf("Deleted: %d\n", deleted)
	fmt.Printf("Missing: %d\n", missing)
	fmt.Printf("Failed:  %d\n", failed)

	if failed > 0 {
		return fmt.Errorf("%d account(s) failed", failed)
	}

	return nil
}
