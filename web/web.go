package web

import (
	"embed"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"workshop/internal/domain/sighting"
	"workshop/internal/infra/config"
	"workshop/web/handlers"
)

//go:generate go tool templ generate ./...

// assets holds the static files served under /assets.
// Note: The embedded paths keep their "assets/" prefix.
//
//go:embed assets
var assets embed.FS

// New returns a ServeMux serving the static assets and handler's patterns.
func New(logger *slog.Logger, config config.Config, sightingsSvc *sighting.Service) *http.ServeMux {
	mux := http.NewServeMux()

	files := http.FileServerFS(assetsFs(config.IsProduction()))
	if !config.IsProduction() {
		files = revalidate(files)
	}
	mux.Handle("GET /assets/", files)
	mux.Handle("GET /", handlers.Home(logger, sightingsSvc))

	return mux
}

// revalidate makes browsers check for a newer asset on every load, for development.
func revalidate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-cache")
		next.ServeHTTP(w, r)
	})
}

func assetsFs(prod bool) fs.FS {
	if prod {
		return assets
	}
	return os.DirFS("web")
}
