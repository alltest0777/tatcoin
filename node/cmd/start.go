package cmd

import (
    "fmt"
    "tatcoin/app"
)

func StartCmd() {
    fmt.Println("Starting TatCoin node...")
    app.StartNode()
}