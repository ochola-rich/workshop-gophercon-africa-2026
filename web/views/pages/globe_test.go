package pages

import (
	"testing"

	"workshop/internal/domain/sighting"
	"workshop/internal/domain/species"
)

func seen(region, country string, lat, lng float64, name string) sighting.Sighting {
	return sighting.Sighting{
		Location: sighting.Location{
			StateProvince: region,
			Country:       country,
			Coordinates:   sighting.Coordinates{Latitude: lat, Longitude: lng},
		},
		Species: species.Species{CanonicalName: name, VernacularName: name},
	}
}

func TestPlaces(t *testing.T) {
	got := Places([]sighting.Sighting{
		seen("Taita-Taveta", "Kenya", -3.4, 38.5, "Loxodonta africana"),
		seen("Taita Taveta", "Kenya", -3.2, 38.3, "Crocodylus niloticus"),
		seen("Narok", "Kenya", -1.5, 35.1, "Acinonyx jubatus"),
		seen("", "Botswana", -19.0, 23.0, "Lycaon pictus"),
	})

	if len(got) != 3 {
		t.Fatalf("got %d places, want 3: %+v", len(got), got)
	}
	if got[0].Label() != "Taita-Taveta, Kenya" || got[0].Count != 2 || len(got[0].Animals) != 2 {
		t.Errorf("busiest place = %q with %d sightings, %d animals", got[0].Label(), got[0].Count, len(got[0].Animals))
	}
	if lat := got[0].Lat; lat > -3.29 || lat < -3.31 {
		t.Errorf("Taita-Taveta lat = %v, want the mean -3.3", lat)
	}

	groups := ByCountry(got)
	if len(groups) != 2 || groups[0].Country != "Kenya" || groups[0].Count != 3 || len(groups[0].Places) != 2 {
		t.Errorf("groups = %+v", groups)
	}
	if b := groups[1].Places[0]; b.Region != "" || b.Label() != "Botswana" {
		t.Errorf("a place without a region should be the whole country, got %q", b.Label())
	}
}
