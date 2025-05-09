"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { toast } from "react-fox-toast"
import { Map } from 'lucide-react'
// If using leaflet-routing-machine, install and import:
import 'leaflet-routing-machine'
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css'
import { RefreshCcw } from "lucide-react"


// Fix Leaflet icon issues
const fixLeafletIcon = () => {
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  })
}

interface MapComponentProps {
  onLocationChange: (location: { city: string; state: string; country: string; lat: string; lon: string }) => void
  radius?: number
  poi?: Array<{ lat: number; lon: number; name?: string; category?: string }>
}

export default function MapComponent({ onLocationChange, radius = 1000, poi = [] }: MapComponentProps) {
  const mapRef = useRef<L.Map | null>(null)
  const circleRef = useRef<L.Circle | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRouteAvailable, setIsRouteAvailable] = useState(false); // Local state to track route availability

  const userMarkerRef = useRef<L.Marker | null>(null)
  const routeControlRef = useRef<any>(null)
  const lastDestRef = useRef<L.LatLng | null>(null)
  const markersRef = useRef<L.Marker[]>([])

  const createRoutingControl = (start: L.LatLng, end: L.LatLng) => {
    return (L as any).Routing.control({
      waypoints: [start, end],
      lineOptions: { addWaypoints: false },
      draggableWaypoints: false,
      fitSelectedRoutes: true,
      showAlternatives: false,
      createMarker: () => null,  // disable default markers
    })
  }

  const clearExistingRoute = () => {
    if (routeControlRef.current) {
      mapRef.current?.removeControl(routeControlRef.current);
      routeControlRef.current = null;
      setIsRouteAvailable(false); // Update local state
      lastDestRef.current = null
    }
  };

  const handleClearRoute = () => {
    clearExistingRoute();
  };

  useEffect(() => {
    if (routeControlRef.current) {
      setIsRouteAvailable(true); // Update local state when route is available
    }
  }, [routeControlRef.current]);

  useEffect(() => {
    markersRef.current.forEach(m => mapRef.current?.removeLayer(m))
    markersRef.current = []
    // Clear existing route paths
    clearExistingRoute()

    poi.forEach(p => {
      if (!p.name || !p.category) return;
      const redIcon = L.icon({
        iconUrl: 'https://www.svgrepo.com/show/476893/marker.svg',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        shadowSize: [41, 41]
      });

      const marker = L.marker([p.lat, p.lon], { icon: redIcon }).addTo(mapRef.current!);
      marker.bindPopup(`<b>${p.name}</b><br>${p.category}`);
      // marker.bindTooltip(`<b>${p.name}</b><br>${p.category}`);

      // Add hover event to show name and category
      marker.on('mouseover', () => {
        marker.openPopup();
      });

      marker.on('mouseout', () => {
        marker.closePopup();
      });

      marker.on('click', e => {
        L.DomEvent.stopPropagation(e)
        const map = mapRef.current
        const userMarker = userMarkerRef.current
        if (!userMarker || !map) return

        const destLatLng = L.latLng(p.lat, p.lon)
        // toggle route
        if (lastDestRef.current && destLatLng.equals(lastDestRef.current)) {
          if (routeControlRef.current) {
            debugger
            map.removeControl(routeControlRef.current)
            routeControlRef.current = null
            setIsRouteAvailable(false); // Update local state
          }
          lastDestRef.current = null
        } else {
          if (routeControlRef.current) map.removeControl(routeControlRef.current)
          routeControlRef.current = createRoutingControl(userMarker.getLatLng(), destLatLng).addTo(map)
          lastDestRef.current = destLatLng
          setIsRouteAvailable(true); // Update local state
        }
      });

      markersRef.current.push(marker);
    });
  }, [poi])

  useEffect(() => {
    fixLeafletIcon()
    if (!mapRef.current) {
      const map = L.map('map').setView([51.505, -0.09], 13)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map)
      mapRef.current = map

      if (navigator.geolocation) {
        setIsLoading(true)
        navigator.geolocation.getCurrentPosition(
          async position => {
            const { latitude, longitude } = position.coords
            map.setView([latitude, longitude], 13)
            const marker = L.marker([latitude, longitude], { draggable: true }).addTo(map)
            userMarkerRef.current = marker
            circleRef.current = L.circle([latitude, longitude], { radius }).addTo(map)
            await getLocationInfo(latitude, longitude, onLocationChange)

            marker.on('dragend', async e => {
              const latlng = e.target.getLatLng()
              circleRef.current?.setLatLng(latlng)
              const toastId = toast('Updating Location ...', { position: 'top-center' })
              const loc = await getLocationInfo(latlng.lat, latlng.lng, onLocationChange)
              toast.update(toastId, {
                message: `Location Updated to ${loc.city}, ${loc.state}, ${loc.country}`,
                icon: <Map />, position: 'top-center'
              })
              if (lastDestRef.current) {
                clearExistingRoute();
                routeControlRef.current = createRoutingControl(latlng, lastDestRef.current).addTo(map)
                setIsRouteAvailable(true); // Update local state
              }
            })

            map.on('click', async e => {
              const latlng = e.latlng
              marker.setLatLng(latlng)
              circleRef.current?.setLatLng(latlng)
              const toastId = toast('Updating Location ...', { position: 'top-center' })
              const loc = await getLocationInfo(latlng.lat, latlng.lng, onLocationChange)
              toast.update(toastId, {
                message: `Location Updated to ${loc.city}, ${loc.state}, ${loc.country}`,
                icon: <Map />, position: 'top-center'
              })
              if (lastDestRef.current) {
                if (routeControlRef.current) map.removeControl(routeControlRef.current)
                routeControlRef.current = createRoutingControl(latlng, lastDestRef.current).addTo(map)
                setIsRouteAvailable(true); // Update local state
              }
            })

            setIsLoading(false)
          },
          err => {
            console.error('Error getting location:', err)
            setError('Could not get your location. Using default location.')
            setIsLoading(false)
            getLocationInfo(51.505, -0.09, onLocationChange)
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        )
      } else {
        setError('Geolocation is not supported by your browser')
        setIsLoading(false)
        getLocationInfo(51.505, -0.09, onLocationChange)
      }
    }
  }, [onLocationChange])

  useEffect(() => {
    if (mapRef.current && circleRef.current) circleRef.current.setRadius(radius)
  }, [radius])

  const getLocationInfo = async (
    lat: number,
    lng: number,
    callback: (loc: { city: string; state: string; country: string; lat: string; lon: string }) => void
  ) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`)
      const data = await response.json()
      const city = data.address.city || data.address.town || data.address.village || data.address.hamlet || 'Unknown'
      const state = data.address.state || data.address.county || 'Unknown'
      const country = data.address.country || 'Unknown'
      callback({ city, state, country, lat: lat.toString(), lon: lng.toString() })
      return { city, state, country, lat: lat.toString(), lon: lng.toString() }
    } catch (e) {
      console.error('Error getting location info:', e)
      callback({ city: 'Unknown', state: 'Unknown', country: 'Unknown', lat: lat.toString(), lon: lng.toString() })
      return { city: 'Unknown', state: 'Unknown', country: 'Unknown', lat: lat.toString(), lon: lng.toString() }
    }
  }

  return (
    <div className="relative h-full w-full">
      <div id="map" className="h-full w-full rounded-lg" />
      {isRouteAvailable && <button
        onClick={handleClearRoute}
        className="absolute z-[400] top-4 left-[50%] bg-red-500 text-white p-1 rounded shadow-lg hover:bg-red-600"
      >
        <RefreshCcw size={15}/>
      </button>}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
            <p className="mt-2 text-sm text-gray-600">Loading map...</p>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute bottom-2 left-2 right-2 bg-red-100 text-red-800 p-2 rounded text-sm">{error}</div>
      )}
    </div>
  )
}
