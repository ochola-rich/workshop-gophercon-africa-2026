package pages

import (
	"cmp"
	"slices"
	"strings"

	"workshop/internal/domain/sighting"
	"workshop/internal/domain/species"
)

type (
	// Place is one dot on the globe: every sighting in a country.
	Place struct {
		Country string        `json:"country"`
		Lat     float64       `json:"lat"`
		Lng     float64       `json:"lng"`
		Count   int           `json:"count"`
		Animals []PlaceAnimal `json:"animals"`
	}
	// PlaceAnimal is one slice of a place's wheel.
	PlaceAnimal struct {
		Name        string      `json:"name"`
		Scientific  string      `json:"scientific"`
		Class       string      `json:"class,omitzero"`
		Order       string      `json:"order,omitzero"`
		Family      string      `json:"family,omitzero"`
		Count       int         `json:"count"`
		Individuals int         `json:"individuals"`
		FirstSeen   string      `json:"firstSeen"`
		LastSeen    string      `json:"lastSeen"`
		Photo       string      `json:"photo,omitzero"`
		Credit      string      `json:"credit,omitzero"`
		Observers   []string    `json:"observers"`
		Sightings   []PlaceSeen `json:"sightings"`
		Fact        *Fact       `json:"fact,omitzero"`
	}
	// PlaceSeen is a single sighting listed in an animal's card.
	PlaceSeen struct {
		ID    string `json:"id"`
		Date  string `json:"date"`
		Where string `json:"where"`
	}
	// GlobeStats are the headline numbers beside the globe.
	GlobeStats struct {
		Sightings int
		Countries int
		Species   int
	}
)

// Places groups sightings by country, busiest first, with each country's animals.
func Places(sightings []sighting.Sighting) []Place {
	type acc struct {
		place          Place
		latSum, lngSum float64
		points         int
		animals        map[string]int
	}
	byCountry := map[string]*acc{}
	var order []string

	for _, s := range sightings {
		country := cmp.Or(s.Location.Country, s.Location.CountryCode.String())
		if country == "" {
			continue
		}
		a, ok := byCountry[country]
		if !ok {
			a = &acc{place: Place{Country: country}, animals: map[string]int{}}
			byCountry[country] = a
			order = append(order, country)
		}
		a.place.Count++
		if s.Location.Latitude != 0 || s.Location.Longitude != 0 {
			a.latSum += s.Location.Latitude
			a.lngSum += s.Location.Longitude
			a.points++
		}

		key := speciesKey(s.Species)
		i, ok := a.animals[key]
		if !ok {
			i = len(a.place.Animals)
			a.animals[key] = i
			a.place.Animals = append(a.place.Animals, newPlaceAnimal(s.Species))
		}
		addSighting(&a.place.Animals[i], s)
	}

	places := make([]Place, 0, len(order))
	for _, country := range order {
		a := byCountry[country]
		if a.points == 0 {
			continue
		}
		a.place.Lat = a.latSum / float64(a.points)
		a.place.Lng = a.lngSum / float64(a.points)
		slices.SortStableFunc(a.place.Animals, func(x, y PlaceAnimal) int { return y.Count - x.Count })
		places = append(places, a.place)
	}
	slices.SortStableFunc(places, func(x, y Place) int { return y.Count - x.Count })
	return places
}

// Stats counts the sightings, countries and species on the page.
func Stats(sightings []sighting.Sighting, places []Place) GlobeStats {
	kinds := map[string]bool{}
	for _, s := range sightings {
		kinds[speciesKey(s.Species)] = true
	}
	return GlobeStats{Sightings: len(sightings), Countries: len(places), Species: len(kinds)}
}

func newPlaceAnimal(sp species.Species) PlaceAnimal {
	a := PlaceAnimal{
		Name:       titleCase(cmp.Or(sp.VernacularName, sp.CanonicalName, sp.ScientificName, "Unknown species")),
		Scientific: cmp.Or(sp.CanonicalName, sp.ScientificName),
		Class:      sp.Class,
		Order:      sp.Order,
		Family:     sp.Family,
		Observers:  []string{},
		Sightings:  []PlaceSeen{},
	}
	if f, ok := facts[speciesKey(sp)]; ok {
		a.Fact = &f
	}
	return a
}

// addSighting folds one sighting into an animal's totals; sightings arrive newest first.
func addSighting(a *PlaceAnimal, s sighting.Sighting) {
	date := s.HappenedAt.Format("2 Jan 2006")
	if a.Count == 0 {
		a.LastSeen = date
	}
	a.FirstSeen = date
	a.Count++
	if s.IndividualCount != nil && *s.IndividualCount > 0 {
		a.Individuals += *s.IndividualCount
	} else {
		a.Individuals++
	}
	if a.Photo == "" {
		if m, ok := firstPhoto(s.Media); ok {
			a.Photo, a.Credit = m.URL, m.Creator
		}
	}
	for _, o := range strings.Split(s.RecordedBy, ",") {
		if o = strings.TrimSpace(o); o != "" && !slices.Contains(a.Observers, o) && len(a.Observers) < 8 {
			a.Observers = append(a.Observers, o)
		}
	}
	if len(a.Sightings) < 6 {
		a.Sightings = append(a.Sightings, PlaceSeen{ID: s.ID.String(), Date: date, Where: Where(s.Location)})
	}
}

// firstPhoto returns the first still image with a web URL.
func firstPhoto(media []sighting.Media) (sighting.Media, bool) {
	for _, m := range media {
		if m.Type == "StillImage" && (strings.HasPrefix(m.URL, "https://") || strings.HasPrefix(m.URL, "http://")) {
			return m, true
		}
	}
	return sighting.Media{}, false
}

// Where joins whichever parts of the location GBIF supplied.
func Where(l sighting.Location) string {
	parts := slices.DeleteFunc(
		[]string{l.Locality, l.StateProvince, l.Country},
		func(s string) bool { return s == "" },
	)
	return cmp.Or(strings.Join(parts, ", "), "Location unknown")
}

func speciesKey(sp species.Species) string {
	return cmp.Or(sp.CanonicalName, sp.Species, sp.ScientificName, sp.VernacularName)
}

// titleCase capitalises each word of a common name, leaving the rest as GBIF wrote it.
func titleCase(s string) string {
	words := strings.Fields(s)
	for i, w := range words {
		words[i] = strings.ToUpper(w[:1]) + w[1:]
	}
	return strings.Join(words, " ")
}
