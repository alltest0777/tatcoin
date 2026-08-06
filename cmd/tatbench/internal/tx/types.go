package tx

import "time"

type broadcastResult struct {
	Code   uint32 `json:"code"`
	TxHash string `json:"txhash"`
	RawLog string `json:"raw_log"`
}

type queryResult struct {
	Height    string `json:"height"`
	Code      uint32 `json:"code"`
	GasWanted string `json:"gas_wanted"`
	GasUsed   string `json:"gas_used"`
	RawLog    string `json:"raw_log"`
}

type Result struct {
	Name      string
	TxHash    string
	Height    string
	GasUsed   int64
	GasWanted int64
	Confirm   time.Duration
	Err       error
}
