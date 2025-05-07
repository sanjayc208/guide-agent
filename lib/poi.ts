// lib/poi.ts
export type POI = {
    id: string;
    lat: string;
    lon: string;
    name?: string;
    category: string;
};

export async function fetchNearbyPOIs(
    lat: string,
    lon: string,
    radius = 1000,
    category?: string
): Promise<POI[]> {
    console.log("Fetching nearby POIs for:", lat, lon, radius, category);
    const overpassUrl = "https://overpass-api.de/api/interpreter";
    const q = `
      [out:json][timeout:25];
      (
        node(around:${radius},${lat},${lon})[amenity=${category}];
      );
      out body 25;
    `;

    console.log("Overpass query:", q);
    
    const resp = await fetch(overpassUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: q.trim(),
    });

    if (!resp.ok) throw new Error("Overpass error " + resp.status);
    const json = await resp.json();
    return json.elements.map((el: any) => ({
        id: el.id,
        lat: el.lat,
        lon: el.lon,
        name: el.tags.name,
        category:
            el.tags.amenity ||
            el.tags.tourism ||
            el.tags.leisure ||
            el.tags.shop ||
            "unknown",
    }));
}
