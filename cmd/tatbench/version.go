package main

import (
	"fmt"

	"github.com/spf13/cobra"
)

func newVersionCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "version",
		Short: "Print TatBench version",
		Run: func(cmd *cobra.Command, args []string) {
			fmt.Println("TatBench", version)
		},
	}
}
