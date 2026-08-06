package tx

import (
	"fmt"
	"strconv"
	"sync"
	"time"

	"github.com/alltest0777/tatcore/cmd/tatbench/internal/config"
	"github.com/alltest0777/tatcore/cmd/tatbench/internal/report"
)

func runParallel(cfg config.TX) report.Stats {
	if cfg.Accounts <= 0 {
		fmt.Println("accounts must be greater than zero")
		return report.Stats{}
	}

	fmt.Println("Parallel TX Benchmark")
	fmt.Println("---------------------")
	fmt.Printf("Accounts: %d\n", cfg.Accounts)
	fmt.Printf("Prefix:   %s\n", cfg.Prefix)
	fmt.Printf("To:       %s\n", cfg.To)
	fmt.Printf("Amount:   %s\n\n", cfg.Amount)

	start := time.Now()

	results := make(chan Result, cfg.Accounts)

	var wg sync.WaitGroup

	for i := 1; i <= cfg.Accounts; i++ {

		accountName := fmt.Sprintf("%s-%04d", cfg.Prefix, i)

		wg.Add(1)

		go func(name string) {

			defer wg.Done()

			txStart := time.Now()

			br, err := broadcast(
				cfg.Node.Binary,
				cfg.Node.Home,
				cfg.Node.ChainID,
				name,
				cfg.To,
				cfg.Amount,
			)

			if err != nil {
				results <- Result{
					Name: name,
					Err:  fmt.Errorf("broadcast: %w", err),
				}
				return
			}

			if br.Code != 0 {
				results <- Result{
					Name: name,
					Err: fmt.Errorf(
						"CheckTx failed: code=%d log=%s",
						br.Code,
						br.RawLog,
					),
				}
				return
			}

			qr, err := waitForTx(
				cfg.Node.Binary,
				cfg.Node.Home,
				br.TxHash,
				cfg.Timeout,
			)

			if err != nil {
				results <- Result{
					Name:   name,
					TxHash: br.TxHash,
					Err:    err,
				}
				return
			}

			gasUsed, _ := strconv.ParseInt(qr.GasUsed, 10, 64)
			gasWanted, _ := strconv.ParseInt(qr.GasWanted, 10, 64)

			results <- Result{
				Name:      name,
				TxHash:    br.TxHash,
				Height:    qr.Height,
				GasUsed:   gasUsed,
				GasWanted: gasWanted,
				Confirm:   time.Since(txStart),
			}

		}(accountName)
	}

	go func() {
		wg.Wait()
		close(results)
	}()

	var (
		failed  int
		samples []report.Sample
	)

	for r := range results {

		if r.Err != nil {
			failed++
			fmt.Printf("[FAILED] %s: %v\n", r.Name, r.Err)
			continue
		}

		samples = append(samples, report.Sample{
			Height:    r.Height,
			Latency:   r.Confirm,
			GasUsed:   r.GasUsed,
			GasWanted: r.GasWanted,
		})

		fmt.Printf(
			"[OK] %s height=%s confirm=%v gas=%d/%d hash=%s\n",
			r.Name,
			r.Height,
			r.Confirm.Round(time.Millisecond),
			r.GasUsed,
			r.GasWanted,
			r.TxHash,
		)
	}

	elapsed := time.Since(start)
	stats := report.Calculate(samples, failed, elapsed)

	fmt.Println()
	fmt.Println("Summary")
	fmt.Println("-------")
	fmt.Printf("Success:      %d\n", stats.Success)
	fmt.Printf("Failed:       %d\n", stats.Failed)
	fmt.Printf("Duration:     %v\n", stats.Duration)
	fmt.Printf("Throughput:   %.2f tx/sec\n", stats.Throughput)

	if stats.Success > 0 {
		fmt.Println()
		fmt.Println("Latency")
		fmt.Println("-------")
		fmt.Printf("Min:          %v\n", stats.MinLatency.Round(time.Millisecond))
		fmt.Printf("Average:      %v\n", stats.AvgLatency.Round(time.Millisecond))
		fmt.Printf("P50:          %v\n", stats.P50Latency.Round(time.Millisecond))
		fmt.Printf("P95:          %v\n", stats.P95Latency.Round(time.Millisecond))
		fmt.Printf("P99:          %v\n", stats.P99Latency.Round(time.Millisecond))
		fmt.Printf("Max:          %v\n", stats.MaxLatency.Round(time.Millisecond))

		fmt.Println()
		fmt.Println("Blocks")
		fmt.Println("------")
		fmt.Printf("Blocks used:   %d\n", stats.BlocksUsed)
		fmt.Printf("Peak tx/block: %d\n", stats.PeakTxBlock)
		fmt.Println("Tx per block:")

		for _, block := range stats.Blocks {
			fmt.Printf("  %s: %d tx\n", block.Height, block.Tx)
		}

		fmt.Println()
		fmt.Println("Gas")
		fmt.Println("---")
		fmt.Printf("Avg used:     %d\n", stats.AvgGasUsed)
		fmt.Printf("Avg wanted:   %d\n", stats.AvgGasWanted)

	}

	return stats

}
