package main

import (
	"fmt"

	accountsbench "github.com/alltest0777/tatcore/cmd/tatbench/internal/accounts"
	"github.com/spf13/cobra"
)

func newAccountsCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "accounts",
		Short: "Manage benchmark accounts",
	}

	cmd.AddCommand(newAccountsCreateCommand())
	cmd.AddCommand(newAccountsFundCommand())
	cmd.AddCommand(newAccountsListCommand())
	cmd.AddCommand(newAccountsBalanceCommand())
	cmd.AddCommand(newAccountsDeleteCommand())

	return cmd
}

func newAccountsCreateCommand() *cobra.Command {
	var (
		binary string
		home   string
		prefix string
		count  int
	)

	cmd := &cobra.Command{
		Use:   "create",
		Short: "Create benchmark accounts in the test keyring",
		RunE: func(cmd *cobra.Command, args []string) error {
			if count <= 0 {
				return fmt.Errorf("count must be greater than zero")
			}
			if prefix == "" {
				return fmt.Errorf("prefix cannot be empty")
			}

			return accountsbench.Create(binary, home, prefix, count)
		},
	}

	cmd.Flags().StringVar(
		&binary,
		"binary",
		"/home/ubuntu/tatcore/tatcoind",
		"path to tatcoind",
	)
	cmd.Flags().StringVar(
		&home,
		"home",
		"/home/ubuntu/.tatcore",
		"node home directory",
	)
	cmd.Flags().StringVar(
		&prefix,
		"prefix",
		"bench",
		"benchmark account name prefix",
	)
	cmd.Flags().IntVar(
		&count,
		"count",
		5,
		"number of accounts",
	)

	return cmd
}

func newAccountsFundCommand() *cobra.Command {
	var (
		binary string
		home   string
		chain  string
		from   string
		prefix string
		amount string
		start  int
		count  int
	)

	cmd := &cobra.Command{
		Use:   "fund",
		Short: "Fund benchmark accounts",
		RunE: func(cmd *cobra.Command, args []string) error {
			return accountsbench.Fund(
				binary,
				home,
				chain,
				from,
				prefix,
				amount,
				start,
				count,
			)
		},
	}

	cmd.Flags().StringVar(&binary, "binary", "/home/ubuntu/tatcore/tatcoind", "path to tatcoind")
	cmd.Flags().StringVar(&home, "home", "/home/ubuntu/.tatcore", "node home directory")
	cmd.Flags().StringVar(&chain, "chain-id", "tat-1", "chain ID")
	cmd.Flags().StringVar(&from, "from", "faucet", "funding key name")
	cmd.Flags().StringVar(&prefix, "prefix", "bench", "benchmark account name prefix")
	cmd.Flags().StringVar(&amount, "amount", "10000000utat", "amount per account")
	cmd.Flags().IntVar(&count, "count", 5, "number of accounts")
	cmd.Flags().IntVar(&start, "start", 1, "first account index")

	return cmd
}

func newAccountsListCommand() *cobra.Command {
	var (
		binary string
		home   string
		prefix string
		count  int
	)

	cmd := &cobra.Command{
		Use:   "list",
		Short: "List benchmark accounts",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if count <= 0 {
				return fmt.Errorf("count must be greater than zero")
			}

			if prefix == "" {
				return fmt.Errorf("prefix cannot be empty")
			}

			return accountsbench.List(
				binary,
				home,
				prefix,
				count,
			)
		},
	}

	cmd.Flags().StringVar(
		&binary,
		"binary",
		"/home/ubuntu/tatcore/tatcoind",
		"path to tatcoind",
	)

	cmd.Flags().StringVar(
		&home,
		"home",
		"/home/ubuntu/.tatcore",
		"node home directory",
	)

	cmd.Flags().StringVar(
		&prefix,
		"prefix",
		"bench",
		"benchmark account name prefix",
	)

	cmd.Flags().IntVar(
		&count,
		"count",
		20,
		"number of account names to inspect",
	)

	return cmd
}

func newAccountsBalanceCommand() *cobra.Command {
	var (
		binary string
		home   string
		prefix string
		denom  string
		start  int
		count  int
	)

	cmd := &cobra.Command{
		Use:   "balance",
		Short: "Show balances of benchmark accounts",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {

			return accountsbench.Balances(
				binary,
				home,
				prefix,
				denom,
				start,
				count,
			)
		},
	}

	cmd.Flags().StringVar(
		&binary,
		"binary",
		"/home/ubuntu/tatcore/tatcoind",
		"path to tatcoind",
	)

	cmd.Flags().StringVar(
		&home,
		"home",
		"/home/ubuntu/.tatcore",
		"node home directory",
	)

	cmd.Flags().StringVar(
		&prefix,
		"prefix",
		"bench",
		"benchmark account prefix",
	)

	cmd.Flags().StringVar(
		&denom,
		"denom",
		"utat",
		"coin denomination",
	)

	cmd.Flags().IntVar(
		&start,
		"start",
		1,
		"first account index",
	)

	cmd.Flags().IntVar(
		&count,
		"count",
		20,
		"number of accounts",
	)

	return cmd
}

func newAccountsDeleteCommand() *cobra.Command {
	var (
		binary string
		home   string
		prefix string
		start  int
		count  int
		yes    bool
	)

	cmd := &cobra.Command{
		Use:   "delete",
		Short: "Delete benchmark accounts",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {

			if !yes {
				return fmt.Errorf(
					"this command permanently deletes keys; rerun with --yes",
				)
			}

			return accountsbench.Delete(
				binary,
				home,
				prefix,
				start,
				count,
			)
		},
	}

	cmd.Flags().StringVar(&binary,
		"binary",
		"/home/ubuntu/tatcore/tatcoind",
		"path to tatcoind",
	)

	cmd.Flags().StringVar(&home,
		"home",
		"/home/ubuntu/.tatcore",
		"node home directory",
	)

	cmd.Flags().StringVar(&prefix,
		"prefix",
		"bench",
		"benchmark account prefix",
	)

	cmd.Flags().IntVar(&start,
		"start",
		1,
		"first account index",
	)

	cmd.Flags().IntVar(&count,
		"count",
		20,
		"number of accounts",
	)

	cmd.Flags().BoolVar(&yes,
		"yes",
		false,
		"confirm deletion",
	)

	return cmd
}
