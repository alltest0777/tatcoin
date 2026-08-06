package tx

import "github.com/alltest0777/tatcore/cmd/tatbench/internal/config"

func Run(cfg config.TX) {
	runSequential(cfg)
}

func RunParallel(cfg config.TX) {
	runParallel(cfg)
}
