package tx

import (
	"fmt"
	"time"

	"github.com/alltest0777/tatcore/cmd/tatbench/internal/config"
)

type SoakConfig struct {
	TX       config.TX
	Duration time.Duration
	Interval time.Duration
}

func RunSoak(cfg SoakConfig) {
	if cfg.Duration <= 0 {
		fmt.Println("duration must be greater than zero")
		return
	}

	if cfg.Interval < 0 {
		fmt.Println("interval cannot be negative")
		return
	}

	fmt.Println("Soak TX Benchmark")
	fmt.Println("-----------------")
	fmt.Printf("Accounts: %d\n", cfg.TX.Accounts)
	fmt.Printf("Prefix:   %s\n", cfg.TX.Prefix)
	fmt.Printf("To:       %s\n", cfg.TX.To)
	fmt.Printf("Amount:   %s\n", cfg.TX.Amount)
	fmt.Printf("Duration: %v\n", cfg.Duration)
	fmt.Printf("Interval: %v\n\n", cfg.Interval)

	startedAt := time.Now()
	deadline := startedAt.Add(cfg.Duration)
	round := 0

	var (
		totalSuccess    int
		totalFailed     int
		totalRoundTime  time.Duration
		totalThroughput float64
		bestThroughput  float64
		worstThroughput float64
	)

	for time.Now().Before(deadline) {
		round++

		fmt.Printf("Round %d\n", round)
		fmt.Println("-------")

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

		remaining := time.Until(deadline)
		if remaining <= 0 {
			break
		}

		sleepFor := cfg.Interval
		if sleepFor > remaining {
			sleepFor = remaining
		}

		if sleepFor > 0 {
			fmt.Printf("\nNext round in %v\n\n", sleepFor.Round(time.Millisecond))
			time.Sleep(sleepFor)
		}
	}

	elapsed := time.Since(startedAt)

	fmt.Println()
	fmt.Println("Soak Summary")
	fmt.Println("------------")
	fmt.Printf("Rounds:          %d\n", round)
	fmt.Printf("Success:         %d\n", totalSuccess)
	fmt.Printf("Failed:          %d\n", totalFailed)
	fmt.Printf("Transactions:    %d\n", totalSuccess+totalFailed)
	fmt.Printf("Duration:        %v\n", elapsed.Round(time.Millisecond))

	if round > 0 {
		fmt.Printf(
			"Avg round time:  %v\n",
			(totalRoundTime / time.Duration(round)).Round(time.Millisecond),
		)
		fmt.Printf("Avg throughput:  %.2f tx/sec\n", totalThroughput/float64(round))
		fmt.Printf("Best throughput: %.2f tx/sec\n", bestThroughput)
		fmt.Printf("Worst throughput:%.2f tx/sec\n", worstThroughput)
	}

	if elapsed > 0 {
		fmt.Printf(
			"Overall rate:    %.2f tx/sec\n",
			float64(totalSuccess)/elapsed.Seconds(),
		)
	}

}
