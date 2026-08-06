package report

import (
	"sort"
	"strconv"
	"time"
)

type Sample struct {
	Height    string
	Latency   time.Duration
	GasUsed   int64
	GasWanted int64
}

type BlockStat struct {
	Height string
	Tx     int
}

type Stats struct {
	Success int
	Failed  int

	Duration   time.Duration
	Throughput float64

	MinLatency time.Duration
	AvgLatency time.Duration
	P50Latency time.Duration
	P95Latency time.Duration
	P99Latency time.Duration
	MaxLatency time.Duration

	AvgGasUsed   int64
	AvgGasWanted int64

	BlocksUsed  int
	PeakTxBlock int
	TxPerBlock  map[string]int
	Blocks      []BlockStat
}

func Calculate(
	samples []Sample,
	failed int,
	duration time.Duration,
) Stats {
	stats := Stats{
		Success:    len(samples),
		Failed:     failed,
		Duration:   duration,
		TxPerBlock: make(map[string]int),
	}

	if duration > 0 {
		stats.Throughput = float64(len(samples)) / duration.Seconds()
	}

	if len(samples) == 0 {
		return stats
	}

	latencies := make([]time.Duration, 0, len(samples))

	var (
		totalLatency   time.Duration
		totalGasUsed   int64
		totalGasWanted int64
	)

	for _, sample := range samples {
		latencies = append(latencies, sample.Latency)
		totalLatency += sample.Latency
		totalGasUsed += sample.GasUsed
		totalGasWanted += sample.GasWanted

		stats.TxPerBlock[sample.Height]++
	}

	sort.Slice(latencies, func(i, j int) bool {
		return latencies[i] < latencies[j]
	})

	stats.MinLatency = latencies[0]
	stats.MaxLatency = latencies[len(latencies)-1]
	stats.AvgLatency = totalLatency / time.Duration(len(latencies))
	stats.P50Latency = percentile(latencies, 50)
	stats.P95Latency = percentile(latencies, 95)
	stats.P99Latency = percentile(latencies, 99)

	stats.AvgGasUsed = totalGasUsed / int64(len(samples))
	stats.AvgGasWanted = totalGasWanted / int64(len(samples))

	stats.BlocksUsed = len(stats.TxPerBlock)

	for height, txCount := range stats.TxPerBlock {
		stats.Blocks = append(stats.Blocks, BlockStat{
			Height: height,
			Tx:     txCount,
		})

		if txCount > stats.PeakTxBlock {
			stats.PeakTxBlock = txCount
		}
	}

	sort.Slice(stats.Blocks, func(i, j int) bool {
		left, leftErr := strconv.ParseInt(stats.Blocks[i].Height, 10, 64)
		right, rightErr := strconv.ParseInt(stats.Blocks[j].Height, 10, 64)

		if leftErr == nil && rightErr == nil {
			return left < right
		}

		return stats.Blocks[i].Height < stats.Blocks[j].Height
	})

	return stats
}

func percentile(
	values []time.Duration,
	percent int,
) time.Duration {
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
