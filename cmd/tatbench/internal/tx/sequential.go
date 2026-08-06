package tx

import (
	"fmt"
	"strconv"
	"time"

	"github.com/alltest0777/tatcore/cmd/tatbench/internal/config"
)

func runSequential(cfg config.TX) {
	if cfg.Count <= 0 {
		fmt.Println("count must be greater than zero")
		return
	}

	var (
		success        int
		failed         int
		totalConfirm   time.Duration
		totalGasUsed   int64
		totalGasWanted int64
		benchmarkStart = time.Now()
	)

	fmt.Println("TX Benchmark")
	fmt.Println("------------")
	fmt.Printf("From:         %s\n", cfg.From)
	fmt.Printf("To:           %s\n", cfg.To)
	fmt.Printf("Amount:       %s\n", cfg.Amount)
	fmt.Printf("Transactions: %d\n\n", cfg.Count)

	for i := 1; i <= cfg.Count; i++ {
		txStart := time.Now()

		result, err := broadcast(
			cfg.Node.Binary,
			cfg.Node.Home,
			cfg.Node.ChainID,
			cfg.From,
			cfg.To,
			cfg.Amount,
		)
		if err != nil {
			failed++
			fmt.Printf("[%d/%d] broadcast failed: %v\n", i, cfg.Count, err)
			continue
		}

		if result.Code != 0 {
			failed++
			fmt.Printf(
				"[%d/%d] CheckTx failed: code=%d log=%s\n",
				i,
				cfg.Count,
				result.Code,
				result.RawLog,
			)
			continue
		}

		confirmed, err := waitForTx(
			cfg.Node.Binary,
			cfg.Node.Home,
			result.TxHash,
			cfg.Timeout,
		)
		if err != nil {
			failed++
			fmt.Printf("[%d/%d] confirmation failed: %v\n", i, cfg.Count, err)
			continue
		}

		confirmationTime := time.Since(txStart)
		totalConfirm += confirmationTime
		success++

		if gas, err := strconv.ParseInt(confirmed.GasUsed, 10, 64); err == nil {
			totalGasUsed += gas
		}

		if gas, err := strconv.ParseInt(confirmed.GasWanted, 10, 64); err == nil {
			totalGasWanted += gas
		}

		fmt.Printf(
			"[%d/%d] OK height=%s confirm=%v gas=%s/%s hash=%s\n",
			i,
			cfg.Count,
			confirmed.Height,
			confirmationTime.Round(time.Millisecond),
			confirmed.GasUsed,
			confirmed.GasWanted,
			result.TxHash,
		)
	}

	elapsed := time.Since(benchmarkStart)

	fmt.Println()
	fmt.Println("Summary")
	fmt.Println("-------")
	fmt.Printf("Success:      %d\n", success)
	fmt.Printf("Failed:       %d\n", failed)
	fmt.Printf("Duration:     %v\n", elapsed)
	fmt.Printf("Throughput:   %.2f tx/sec\n", float64(success)/elapsed.Seconds())

	if success > 0 {
		fmt.Printf(
			"Avg confirm:  %v\n",
			(totalConfirm / time.Duration(success)).Round(time.Millisecond),
		)
		fmt.Printf("Avg gas used: %d\n", totalGasUsed/int64(success))
		fmt.Printf("Avg gas want: %d\n", totalGasWanted/int64(success))
	}
}
