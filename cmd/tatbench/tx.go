package main

import (
	"fmt"

	"github.com/alltest0777/tatcore/cmd/tatbench/internal/config"
	txbench "github.com/alltest0777/tatcore/cmd/tatbench/internal/tx"
	"github.com/spf13/cobra"

	"time"
)

func newTXCommand() *cobra.Command {
	cfg := config.DefaultTX()

	cmd := &cobra.Command{
		Use:   "tx",
		Short: "Run a sequential bank-send transaction benchmark",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if cfg.Count <= 0 {
				return fmt.Errorf("count must be greater than zero")
			}

			if cfg.To == "" {
				return fmt.Errorf("--to is required")
			}

			txbench.Run(cfg)

			return nil
		},
	}

	cmd.Flags().StringVar(&cfg.Node.Binary, "binary", cfg.Node.Binary, "path to tatcoind")
	cmd.Flags().StringVar(&cfg.Node.Home, "home", cfg.Node.Home, "node home directory")
	cmd.Flags().StringVar(&cfg.Node.ChainID, "chain-id", cfg.Node.ChainID, "chain ID")
	cmd.Flags().StringVar(&cfg.From, "from", cfg.From, "sender key name")
	cmd.Flags().StringVar(&cfg.To, "to", cfg.To, "recipient address")
	cmd.Flags().StringVar(&cfg.Amount, "amount", cfg.Amount, "amount per transaction")
	cmd.Flags().IntVar(&cfg.Count, "count", cfg.Count, "number of transactions")
	cmd.Flags().DurationVar(&cfg.Timeout, "timeout", cfg.Timeout, "transaction confirmation timeout")

	cmd.AddCommand(newTXParallelCommand())
	cmd.AddCommand(newTXSoakCommand())
	cmd.AddCommand(newTXSpamCommand())

	_ = cmd.MarkFlagRequired("to")

	return cmd
}

func newTXParallelCommand() *cobra.Command {
	cfg := config.DefaultTX()

	cmd := &cobra.Command{
		Use:   "parallel",
		Short: "Run parallel transactions from benchmark accounts",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if cfg.Accounts <= 0 {
				return fmt.Errorf("accounts must be greater than zero")
			}

			if cfg.Prefix == "" {
				return fmt.Errorf("prefix cannot be empty")
			}

			if cfg.To == "" {
				return fmt.Errorf("--to is required")
			}

			txbench.RunParallel(cfg)

			return nil
		},
	}

	cmd.Flags().StringVar(&cfg.Node.Binary, "binary", cfg.Node.Binary, "path to tatcoind")
	cmd.Flags().StringVar(&cfg.Node.Home, "home", cfg.Node.Home, "node home directory")
	cmd.Flags().StringVar(&cfg.Node.ChainID, "chain-id", cfg.Node.ChainID, "chain ID")
	cmd.Flags().StringVar(&cfg.Prefix, "prefix", cfg.Prefix, "benchmark account prefix")
	cmd.Flags().StringVar(&cfg.To, "to", cfg.To, "recipient address")
	cmd.Flags().StringVar(&cfg.Amount, "amount", cfg.Amount, "amount per transaction")
	cmd.Flags().IntVar(&cfg.Accounts, "accounts", cfg.Accounts, "number of sender accounts")
	cmd.Flags().DurationVar(&cfg.Timeout, "timeout", cfg.Timeout, "transaction confirmation timeout")

	_ = cmd.MarkFlagRequired("to")

	return cmd
}

func newTXSoakCommand() *cobra.Command {
	cfg := config.DefaultTX()

	var (
		duration time.Duration
		interval time.Duration
	)

	cmd := &cobra.Command{
		Use:   "soak",
		Short: "Run repeated parallel transaction rounds",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if cfg.Accounts <= 0 {
				return fmt.Errorf("accounts must be greater than zero")
			}
			if cfg.Prefix == "" {
				return fmt.Errorf("prefix cannot be empty")
			}
			if cfg.To == "" {
				return fmt.Errorf("--to is required")
			}
			if duration <= 0 {
				return fmt.Errorf("duration must be greater than zero")
			}
			if interval < 0 {
				return fmt.Errorf("interval cannot be negative")
			}

			txbench.RunSoak(txbench.SoakConfig{
				TX:       cfg,
				Duration: duration,
				Interval: interval,
			})

			return nil
		},
	}

	cmd.Flags().StringVar(&cfg.Node.Binary, "binary", cfg.Node.Binary, "path to tatcoind")
	cmd.Flags().StringVar(&cfg.Node.Home, "home", cfg.Node.Home, "node home directory")
	cmd.Flags().StringVar(&cfg.Node.ChainID, "chain-id", cfg.Node.ChainID, "chain ID")
	cmd.Flags().StringVar(&cfg.Prefix, "prefix", cfg.Prefix, "benchmark account prefix")
	cmd.Flags().StringVar(&cfg.To, "to", cfg.To, "recipient address")
	cmd.Flags().StringVar(&cfg.Amount, "amount", cfg.Amount, "amount per transaction")
	cmd.Flags().IntVar(&cfg.Accounts, "accounts", cfg.Accounts, "number of sender accounts")
	cmd.Flags().DurationVar(&cfg.Timeout, "timeout", cfg.Timeout, "transaction confirmation timeout")
	cmd.Flags().DurationVar(&duration, "duration", time.Minute, "total soak test duration")
	cmd.Flags().DurationVar(&interval, "interval", 10*time.Second, "pause between rounds")

	_ = cmd.MarkFlagRequired("to")

	return cmd
}

func newTXSpamCommand() *cobra.Command {
	cfg := config.DefaultTX()

	var rounds int

	cmd := &cobra.Command{
		Use:   "spam",
		Short: "Run repeated transaction bursts without pauses",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if cfg.Accounts <= 0 {
				return fmt.Errorf("accounts must be greater than zero")
			}
			if cfg.Prefix == "" {
				return fmt.Errorf("prefix cannot be empty")
			}
			if cfg.To == "" {
				return fmt.Errorf("--to is required")
			}
			if rounds <= 0 {
				return fmt.Errorf("rounds must be greater than zero")
			}

			txbench.RunSpam(txbench.SpamConfig{
				TX:     cfg,
				Rounds: rounds,
			})

			return nil
		},
	}

	cmd.Flags().StringVar(
		&cfg.Node.Binary,
		"binary",
		cfg.Node.Binary,
		"path to tatcoind",
	)
	cmd.Flags().StringVar(
		&cfg.Node.Home,
		"home",
		cfg.Node.Home,
		"node home directory",
	)
	cmd.Flags().StringVar(
		&cfg.Node.ChainID,
		"chain-id",
		cfg.Node.ChainID,
		"chain ID",
	)
	cmd.Flags().StringVar(
		&cfg.Prefix,
		"prefix",
		cfg.Prefix,
		"benchmark account prefix",
	)
	cmd.Flags().StringVar(
		&cfg.To,
		"to",
		cfg.To,
		"recipient address",
	)
	cmd.Flags().StringVar(
		&cfg.Amount,
		"amount",
		cfg.Amount,
		"amount per transaction",
	)
	cmd.Flags().IntVar(
		&cfg.Accounts,
		"accounts",
		cfg.Accounts,
		"number of sender accounts",
	)
	cmd.Flags().IntVar(
		&rounds,
		"rounds",
		3,
		"number of burst rounds",
	)
	cmd.Flags().DurationVar(
		&cfg.Timeout,
		"timeout",
		cfg.Timeout,
		"transaction confirmation timeout",
	)

	_ = cmd.MarkFlagRequired("to")

	return cmd
}
