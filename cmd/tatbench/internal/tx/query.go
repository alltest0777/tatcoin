package tx

import (
	"encoding/json"
	"fmt"
	"os/exec"
	"time"
)

func waitForTx(
	binary,
	home,
	txHash string,
	timeout time.Duration,
) (*queryResult, error) {
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
			var result queryResult
			if err := json.Unmarshal(output, &result); err != nil {
				return nil, fmt.Errorf(
					"decode tx query result: %w",
					err,
				)
			}

			if result.Code != 0 {
				return nil, fmt.Errorf(
					"DeliverTx failed: code=%d log=%s",
					result.Code,
					result.RawLog,
				)
			}

			return &result, nil
		}

		time.Sleep(500 * time.Millisecond)
	}

	return nil, fmt.Errorf(
		"timeout waiting for tx %s",
		txHash,
	)
}
