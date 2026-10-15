package pages

import (
	"cmp"
	"slices"
	"strings"

	"workshop/internal/domain/sighting"
	"workshop/internal/domain/species"
)

type (
	// Place is one dot on the globe: every sighting in a region of a country,
	// or in the whole country when GBIF gave no region.
	Place struct {
		Region  string        `json:"region,omitzero"`
		Country string        `json:"country"`
		Lat     float64       `json:"lat"`
		Lng     float64       `json:"lng"`
		Count   int           `json:"count"`
		Animals []PlaceAnimal `json:"animals"`
	}
	// CountryGroup lists a country's places for the Places section.
	CountryGroup struct {
		Country string
		Count   int
		Places  []IndexedPlace
	}
	// IndexedPlace is a place with its position in the globe's data.
	IndexedPlace struct {
		Index int
		Place
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
		Regions   int
		Countries int
		Species   int
	}
)

// Places groups sightings by region, busiest first, with each region's animals.
func Places(sightings []sighting.Sighting) []Place {
	type acc struct {
		place          Place
		latSum, lngSum float64
		points         int
		animals        map[string]int
	}
	byRegion := map[string]*acc{}
	var order []string

	for _, s := range sightings {
		country := cmp.Or(s.Location.Country, s.Location.CountryCode.String())
		if country == "" {
			continue
		}
		region := strings.TrimSpace(s.Location.StateProvince)
		key := regionKey(country, region)
		a, ok := byRegion[key]
		if !ok {
			a = &acc{place: Place{Region: region, Country: country}, animals: map[string]int{}}
			byRegion[key] = a
			order = append(order, key)
		}
		a.place.Count++
		if s.Location.Latitude != 0 || s.Location.Longitude != 0 {
			a.latSum += s.Location.Latitude
			a.lngSum += s.Location.Longitude
			a.points++
		}

		kind := speciesKey(s.Species)
		i, ok := a.animals[kind]
		if !ok {
			i = len(a.place.Animals)
			a.animals[kind] = i
			a.place.Animals = append(a.place.Animals, newPlaceAnimal(s.Species))
		}
		addSighting(&a.place.Animals[i], s)
	}

	places := make([]Place, 0, len(order))
	for _, key := range order {
		a := byRegion[key]
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

// Stats counts the sightings, regions, countries and species on the page.
func Stats(sightings []sighting.Sighting, places []Place) GlobeStats {
	kinds := map[string]bool{}
	for _, s := range sightings {
		kinds[speciesKey(s.Species)] = true
	}
	return GlobeStats{
		Sightings: len(sightings),
		Regions:   len(places),
		Countries: len(ByCountry(places)),
		Species:   len(kinds),
	}
}

// ByCountry gathers places under their country, busiest country first.
func ByCountry(places []Place) []CountryGroup {
	var groups []CountryGroup
	at := map[string]int{}
	for i, p := range places {
		g, ok := at[p.Country]
		if !ok {
			g = len(groups)
			at[p.Country] = g
			groups = append(groups, CountryGroup{Country: p.Country})
		}
		groups[g].Count += p.Count
		groups[g].Places = append(groups[g].Places, IndexedPlace{Index: i, Place: p})
	}
	slices.SortStableFunc(groups, func(x, y CountryGroup) int { return y.Count - x.Count })
	return groups
}

// Label names a place as "Region, Country", or just the country.
func (p Place) Label() string {
	if p.Region == "" {
		return p.Country
	}
	return p.Region + ", " + p.Country
}

// regionKey matches a region however GBIF spelt it ("Taita-Taveta", "Taita Taveta").
func regionKey(country, region string) string {
	r := strings.NewReplacer("-", " ", "_", " ", ".", "").Replace(strings.ToLower(region))
	return strings.ToLower(country) + "|" + strings.Join(strings.Fields(r), " ")
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
