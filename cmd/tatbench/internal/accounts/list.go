package accounts

import (
	"fmt"
	"os/exec"
	"strings"
)

func List(
	binary,
	home,
	prefix string,
	count int,
) error {

	if count <= 0 {
		return fmt.Errorf("count must be greater than zero")
	}

	fmt.Println("Benchmark accounts")
	fmt.Println("------------------")

	found := 0

	for i := 1; i <= count; i++ {

		name := fmt.Sprintf("%s-%04d", prefix, i)

		cmd := exec.Command(
			binary,
			"keys",
			"show",
			name,
			"--address",
			"--keyring-backend",
			"test",
			"--home",
			home,
		)

		out, err := cmd.Output()
		if err != nil {
			continue
		}

		fmt.Printf(
			"%-12s %s\n",
			name,
			strings.TrimSpace(string(out)),
		)

		found++
	}

	fmt.Println()
	fmt.Printf("Found: %d\n", found)

	return nil
}
