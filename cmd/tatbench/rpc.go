package main

import (
	"fmt"

	rpcbench "github.com/alltest0777/tatcore/cmd/tatbench/internal/rpc"
	"github.com/spf13/cobra"
)

func newRPCCommand() *cobra.Command {
	var (
		url         string
		requests    int
		concurrency int
	)

	cmd := &cobra.Command{
		Use:   "rpc",
		Short: "Benchmark a CometBFT RPC endpoint",
		RunE: func(cmd *cobra.Command, args []string) error {
			if requests <= 0 {
				return fmt.Errorf("requests must be greater than zero")
			}
			if concurrency <= 0 {
				return fmt.Errorf("concurrency must be greater than zero")
			}

			rpcbench.Run(url, requests, concurrency)
			return nil
		},
	}

	cmd.Flags().StringVar(
		&url,
		"url",
		"http://127.0.0.1:26657/status",
		"RPC endpoint URL",
	)
	cmd.Flags().IntVar(
		&requests,
		"requests",
		1000,
		"total number of requests",
	)
	cmd.Flags().IntVar(
		&concurrency,
		"concurrency",
		20,
		"number of concurrent workers",
	)

	return cmd
}
