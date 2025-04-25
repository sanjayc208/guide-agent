"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { toast } from "react-fox-toast"
import {Map} from 'lucide-react'
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
  onLocationChange: (location: { city: string; state: string; country: string }) => void
}

export default function MapComponent({ onLocationChange }: MapComponentProps) {
  const mapRef = useRef<L.Map | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Fix Leaflet icon issues
    fixLeafletIcon()

    // Initialize map
    if (!mapRef.current) {
      const map = L.map("map").setView([51.505, -0.09], 13) // Default to London and 13 is the zoom level

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map)

      mapRef.current = map

      // Get user's current location
      if (navigator.geolocation) {
        setIsLoading(true)
        navigator.geolocation.getCurrentPosition(
          (position) => {
            
            const { latitude, longitude }  = position?.coords
            map.setView([latitude, longitude], 13);
            
            // Add marker at user's location
            const marker = L.marker([latitude, longitude], {
              draggable: true, // Make marker draggable
            }).addTo(map)

            // Get location info for initial position
            getLocationInfo(latitude, longitude, onLocationChange)

            // Handle marker drag events
            marker.on("dragend", async (e) => {
              const marker = e.target
              const position = marker.getLatLng()
              
              const toastId = toast(`Updating Location ...`, {position:'top-center'})
              const location:any = await getLocationInfo(position.lat, position.lng, onLocationChange)
              toast.update(toastId, {
                message: `Location Updated to ${location.city}, ${location.state}, ${location.country}`,
                icon: <Map />,
                position:'top-center'
              });
            })

            // Handle map click events to move marker
            map.on("click", async (e) => {
              marker.setLatLng(e.latlng)

              const toastId = toast(`Updating Location ...`, {position:'top-center'})
              
              const location:any = await getLocationInfo(e.latlng.lat, e.latlng.lng, onLocationChange)
              toast.update(toastId, {
                message: `Location Updated to ${location.city}, ${location.state}, ${location.country}`,
                icon: <Map />,
                position:'top-center'
              });
            })

            setIsLoading(false)
          },
          (err) => {
            console.error("Error getting location:", err)
            setError("Could not get your location. Using default location.")
            setIsLoading(false)

            // Still get location info for default position (London)
            getLocationInfo(51.505, -0.09, onLocationChange)
          },
          {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0,
          },
        )
      } else {
        setError("Geolocation is not supported by your browser")
        setIsLoading(false)

        // Still get location info for default position (London)
        getLocationInfo(51.505, -0.09, onLocationChange)
      }
    }

    // return () => {
    //   if (mapRef.current) {
    //     mapRef.current.remove()
    //     mapRef.current = null
    //   }
    // }
  }, [onLocationChange])

  // Function to get location information from coordinates
  const getLocationInfo = async (
    lat: number,
    lng: number,
    callback: (location: { city: string; state: string; country: string }) => void,
  ) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`,
      )
      const data = await response.json()

      const city = data.address.city || data.address.town || data.address.village || data.address.hamlet || "Unknown"
      const state = data.address.state || data.address.county || "Unknown"
      const country = data.address.country || "Unknown"

      console.log(`Location: ${city}, ${state}, ${country}`)
      callback({ city, state, country })
      return { city, state, country }
    } catch (error) {
      console.error("Error getting location info:", error)
      callback({ city: "Unknown", state: "Unknown", country: "Unknown" })
      return { city: "Unknown", state: "Unknown", country: "Unknown" }
    }
  }

  return (
    <div className="relative h-full w-full">
      <div id="map" className="h-full w-full rounded-lg"></div>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
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
