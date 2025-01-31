package main

import (
	"github.com/spf13/viper"
)

type config struct {
	Address        string
	Verbose        bool
	UIAddress      string `mapstructure:"ui_address"`
	DataPath       string `mapstructure:"data_path"`
	DatabaseFile   string `mapstructure:"database_file"`
	SessionKeyFile string `mapstructure:"session_key_file"`
	TLSKeyPath     string `mapstructure:"tls_key_path"`
	TLSCertPath    string `mapstructure:"tls_cert_path"`
	TenorAPIKey    string `mapstructure:"tenor_api_key"`
}

func loadConfig() (*config, error) {
	v := viper.New()

	v.SetDefault("address", "localhost:3000")
	v.SetDefault("verbose", false)
	v.SetDefault("ui_address", "http://localhost:5173")
	v.SetDefault("data_path", "./data")
	v.SetDefault("database_file", "thoughts.sqlite")
	v.SetDefault("session_key_file", "session.key")
	v.SetDefault("tls_key_path", "")
	v.SetDefault("tls_cert_path", "")
	v.SetDefault("tenor_api_key", "")

	v.SetEnvPrefix("thoughts")
	v.AutomaticEnv()

	var cfg config
	err := v.Unmarshal(&cfg)

	return &cfg, err
}
