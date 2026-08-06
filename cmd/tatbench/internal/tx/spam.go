package tx

import (
	"fmt"
	"time"

	"github.com/alltest0777/tatcore/cmd/tatbench/internal/config"
	"github.com/alltest0777/tatcore/cmd/tatbench/internal/report"
)

type SpamConfig struct {
	TX     config.TX
	Rounds int
}

func RunSpam(cfg SpamConfig) report.Stats {
	if cfg.Rounds <= 0 {
		fmt.Println("rounds must be greater than zero")
		return report.Stats{}
	}

	if cfg.TX.Accounts <= 0 {
		fmt.Println("accounts must be greater than zero")
		return report.Stats{}
	}

	fmt.Println("Spam TX Benchmark")
	fmt.Println("-----------------")
	fmt.Printf("Accounts: %d\n", cfg.TX.Accounts)
	fmt.Printf("Rounds:   %d\n", cfg.Rounds)
	fmt.Printf("Prefix:   %s\n", cfg.TX.Prefix)
	fmt.Printf("To:       %s\n", cfg.TX.To)
	fmt.Printf("Amount:   %s\n\n", cfg.TX.Amount)

	startedAt := time.Now()

	var (
		totalSuccess    int
		totalFailed     int
		totalRoundTime  time.Duration
		totalThroughput float64
		bestThroughput  float64
		worstThroughput float64
		allBlocks       = make(map[string]int)
		peakTxBlock     int
	)

	for round := 1; round <= cfg.Rounds; round++ {
		fmt.Printf("Burst %d/%d\n", round, cfg.Rounds)
		fmt.Println("---------")

		stats := runParallel(cfg.TX)

		totalSuccess += stats.Success
		totalFailed += stats.Failed
		totalRoundTime += stats.Duration
		totalThroughput += stats.Throughput

		if round == 1 || stats.Throughput > bestThroughput {
			bestThroughput = stats.Throughput
		}

		if round == 1 || stats.Throughput < worstThroughput {
			worstThroughput = stats.Throughput
		}

		for height, count := range stats.TxPerBlock {
			allBlocks[height] += count

			if allBlocks[height] > peakTxBlock {
				peakTxBlock = allBlocks[height]
			}
		}

		fmt.Println()
	}

	elapsed := time.Since(startedAt)

	finalStats := report.Stats{
		Success:     totalSuccess,
		Failed:      totalFailed,
		Duration:    elapsed,
		Throughput:  0,
		BlocksUsed:  len(allBlocks),
		PeakTxBlock: peakTxBlock,
		TxPerBlock:  allBlocks,
	}

	if elapsed > 0 {
		finalStats.Throughput = float64(totalSuccess) / elapsed.Seconds()
	}

	fmt.Println("Spam Summary")
	fmt.Println("------------")
	fmt.Printf("Rounds:           %d\n", cfg.Rounds)
	fmt.Printf("Success:          %d\n", totalSuccess)
	fmt.Printf("Failed:           %d\n", totalFailed)
	fmt.Printf("Transactions:     %d\n", totalSuccess+totalFailed)
	fmt.Printf("Duration:         %v\n", elapsed.Round(time.Millisecond))
	fmt.Printf("Blocks used:      %d\n", len(allBlocks))
	fmt.Printf("Peak tx/block:    %d\n", peakTxBlock)

	if cfg.Rounds > 0 {
		fmt.Printf(
			"Avg round time:   %v\n",
			(totalRoundTime / time.Duration(cfg.Rounds)).Round(time.Millisecond),
		)
		fmt.Printf(
			"Avg throughput:   %.2f tx/sec\n",
			totalThroughput/float64(cfg.Rounds),
		)
		fmt.Printf("Best throughput:  %.2f tx/sec\n", bestThroughput)
		fmt.Printf("Worst throughput: %.2f tx/sec\n", worstThroughput)
	}

	fmt.Printf("Overall rate:     %.2f tx/sec\n", finalStats.Throughput)

	return finalStats
}
