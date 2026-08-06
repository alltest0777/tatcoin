package rpc

import (
	"fmt"
	"io"
	"net/http"
	"sort"
	"sync"
	"sync/atomic"
	"time"
)

func Run(url string, requests, concurrency int) {
	start := time.Now()

	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	var (
		wg        sync.WaitGroup
		ok        atomic.Int64
		failed    atomic.Int64
		latencies = make([]time.Duration, 0, requests)
		latencyMu sync.Mutex
	)

	jobs := make(chan struct{})

	for i := 0; i < concurrency; i++ {
		wg.Add(1)

		go func() {
			defer wg.Done()

			for range jobs {
				requestStart := time.Now()

				resp, err := client.Get(url)
				elapsed := time.Since(requestStart)

				latencyMu.Lock()
				latencies = append(latencies, elapsed)
				latencyMu.Unlock()

				if err != nil {
					failed.Add(1)
					continue
				}

				_, readErr := io.Copy(io.Discard, resp.Body)
				closeErr := resp.Body.Close()

				if readErr != nil || closeErr != nil {
					failed.Add(1)
					continue
				}

				if resp.StatusCode == http.StatusOK {
					ok.Add(1)
				} else {
					failed.Add(1)
				}
			}
		}()
	}

	for i := 0; i < requests; i++ {
		jobs <- struct{}{}
	}

	close(jobs)
	wg.Wait()

	totalElapsed := time.Since(start)
	successCount := ok.Load()
	failedCount := failed.Load()
	processed := successCount + failedCount

	sort.Slice(latencies, func(i, j int) bool {
		return latencies[i] < latencies[j]
	})

	var totalLatency time.Duration
	for _, latency := range latencies {
		totalLatency += latency
	}

	average := totalLatency / time.Duration(len(latencies))
	p95 := percentile(latencies, 95)
	p99 := percentile(latencies, 99)

	fmt.Println("RPC Benchmark")
	fmt.Println("-------------")
	fmt.Printf("URL:         %s\n", url)
	fmt.Printf("Requests:    %d\n", requests)
	fmt.Printf("Processed:   %d\n", processed)
	fmt.Printf("Success:     %d\n", successCount)
	fmt.Printf("Failed:      %d\n", failedCount)
	fmt.Printf("Concurrency: %d\n", concurrency)
	fmt.Printf("Duration:    %v\n", totalElapsed)
	fmt.Printf("Req/sec:     %.2f\n", float64(processed)/totalElapsed.Seconds())

	if len(latencies) > 0 {
		fmt.Println()
		fmt.Println("Latency")
		fmt.Println("-------")
		fmt.Printf("Min:         %v\n", latencies[0])
		fmt.Printf("Average:     %v\n", average)
		fmt.Printf("P95:         %v\n", p95)
		fmt.Printf("P99:         %v\n", p99)
		fmt.Printf("Max:         %v\n", latencies[len(latencies)-1])
	}

	if processed != int64(requests) {
		fmt.Printf("\nWARNING: processed=%d expected=%d\n", processed, requests)
	}
}

func percentile(values []time.Duration, percent int) time.Duration {
	if len(values) == 0 {
		return 0
	}

	index := (percent*len(values) + 99) / 100
	index--

	if index < 0 {
		index = 0
	}
	if index >= len(values) {
		index = len(values) - 1
	}

	return values[index]
}
