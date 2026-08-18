const fs = require('fs');

const figma = (file) => `assets/images/landing/figma/${file}`;
const icon = (file) => `assets/images/icons/${file}`;

// Paste all the arrays from landing.data.ts here...
const POPULAR_DESTINATIONS = [
  { name: 'Malaysia', price: 'Start at ₹ 60,000/Person', image: figma('malaysia.jpg'), gridArea: 'malaysia', imagePosition: 'center -3%' },
  { name: 'Maldives', price: 'Start at ₹ 43,500/Person', image: figma('maldives.jpg'), gridArea: 'maldives' },
  { name: 'Seychelles', price: 'Start at ₹ 75,300/Person', image: figma('seychelles.jpg'), gridArea: 'seychelles' },
  { name: 'Thailand', price: 'Start at ₹ 56,000/Person', image: figma('thailand.jpg'), gridArea: 'thailand' },
  { name: 'Switzerland', price: 'Start at ₹ 1,65,000/Person', image: figma('switzerland.jpg'), gridArea: 'switzerland' },
  { name: 'Singapore', price: 'Start at ₹ 68,000/Person', image: figma('singapore.jpg'), gridArea: 'singapore' },
];

const BEYOND_TOURIST_TRAIL = [
  { name: 'United Arab Emirates', price: 'Start at ₹ 85,000/Person', image: figma('dubai.jpg'), gridArea: 'uae' },
  { name: 'United State America', price: 'Start at ₹ 3,20,500/Person', image: figma('west-coast.jpg'), gridArea: 'usa' },
  { name: 'Europe', price: 'Start at ₹ 2,52,500/Person', image: figma('france-beyond.jpg'), gridArea: 'europe' },
  { name: 'Australia', price: 'Start at ₹ 1,05,999/Person', image: figma('australia-rated.jpg'), gridArea: 'australia' },
  { name: 'China', price: 'Start at ₹ 2,32,000/Person', image: figma('china.jpg'), gridArea: 'china' },
  { name: 'India', price: 'Start at ₹ 2,56,000/Person', image: 'assets/images/landing/iconic-india.jpg', gridArea: 'india' },
];

const TOP_RATED_TRIPS = [
  { title: 'France', subtitle: 'The French Republic', image: figma('france.jpg') },
  { title: 'Bali', subtitle: 'The Island of the Gods', image: figma('bali-rated.jpg') },
  { title: 'Thailand', subtitle: 'The Kingdom of Thailand', image: figma('thailand-rated.jpg') },
  { title: 'Dubai', subtitle: 'the City of Gold', image: figma('dubai-rated.jpg') },
  { title: 'Japan', subtitle: 'Land of the Rising Sun', image: figma('japan-rated.jpg') },
  { title: 'China', subtitle: 'Factory of the world', image: figma('china-rated.jpg') },
  { title: 'Singapore', subtitle: 'The Lion City', image: figma('singapore-rated.jpg') },
  { title: 'Australia', subtitle: 'The Great Southern Land', image: figma('australia-rated.jpg') },
];

const UNIQUE_EXPERIENCE_TRIPS = [
  { title: 'Kenya', subtitle: 'Wildlife | Adventure', image: figma('kenya.jpg') },
  { title: 'Bali', subtitle: 'Wellness|Culture|Beaches|Adventure', image: figma('bali.jpg') },
  { title: 'Goa', subtitle: 'Beach|Nightlife|Relaxation', image: figma('goa.jpg') },
  { title: 'Fiji', subtitle: 'Luxury | Honeymoon | Adventure', image: figma('fiji.jpg') },
  { title: 'Queensland', subtitle: 'Nature|Reef Diving|Family Travel', image: figma('queensland.jpg') },
  { title: 'Morocco', subtitle: 'Culture|Desert Market', image: figma('morocco.jpg') },
  { title: 'Perth', subtitle: 'Coastal City Life|Wine|Activities', image: figma('perth.jpg') },
  { title: 'Egypt', subtitle: 'History|Desert|Nile', image: figma('egypt.jpg') },
];

const MIDDLE_EAST_TRIPS = [
  { title: 'Dubai', subtitle: 'The city of Life', image: figma('dubai.jpg') },
  { title: 'Abu Dhabi', subtitle: 'A step back in time', image: figma('abu-dhabi.jpg') },
  { title: 'Bahrain', subtitle: 'Island life Pearls', image: figma('bahrain.jpg') },
  { title: 'Qatar', subtitle: 'Land of Luxury', image: figma('qatar.jpg') },
  { title: 'Alula', subtitle: 'The old wonders of', image: figma('alula.jpg') },
  { title: 'Saudi Arabia', subtitle: 'Kingdom of Contrast', image: figma('saudi.jpg') },
  { title: 'Kuwait', subtitle: 'Hollywood of the Gulf', image: figma('kuwait.jpg') },
  { title: 'Muscat', subtitle: 'vibrant port city', image: figma('muscat.jpg') },
  { title: 'Doha', subtitle: 'The shining jewel', image: figma('doha.jpg') },
];

const TRENDING_EUROPE = [
  { title: 'Belgium', subtitle: 'The Capital of Europe', image: figma('belgium.jpg') },
  { title: 'Austria', subtitle: 'Modern Charm', image: figma('austria.jpg') },
  { title: 'London', subtitle: 'The Heartbeat of the British Isles', image: figma('london.jpg') },
  { title: 'Norway', subtitle: "Scandinavia's Green Soul", image: figma('norway.jpg') },
  { title: 'Greece', subtitle: 'Where History Breathes', image: figma('greece.jpg') },
  { title: 'Spain', subtitle: 'Art, Energy, and Seaside Spirit', image: figma('spain.jpg') },
  { title: 'Finland', subtitle: 'Nordic Cool, Urban Calm', image: figma('finland.jpg') },
  { title: 'Italy', subtitle: 'The Eternal City of Passion', image: figma('italy.jpg') },
];

const SOUTH_EAST_ASIA_TRIPS = [
  { title: 'Philippines', subtitle: 'The pearl of the orient', image: figma('philippines.jpg') },
  { title: 'Sri Lanka', subtitle: 'Fall in Love with', image: figma('sri-lanka.jpg') },
  { title: 'Singapore', subtitle: 'The lion city', image: figma('singapore.jpg') },
  { title: 'Malaysia', subtitle: 'Hidden Gems to Explore', image: figma('malaysia.jpg') },
  { title: 'Japan', subtitle: 'Land of Rise sun', image: figma('japan.jpg') },
  { title: 'China', subtitle: 'Middle Kingdom', image: figma('china.jpg') },
];

const UNITED_STATES_TRIPS = [
  { title: 'New York', subtitle: 'The City of Skyscrapers', image: figma('dubai.jpg') },
  { title: 'East coast', subtitle: 'Explore along the atlantic', image: figma('abu-dhabi.jpg') },
  { title: 'Orlando', subtitle: 'World theme park capital', image: figma('bahrain.jpg') },
  { title: 'west coast', subtitle: 'Explore along the Pacific', image: figma('west-coast.jpg') },
  { title: 'Los Angeles', subtitle: 'City of dreams', image: figma('qatar.jpg') },
  { title: 'Dallas', subtitle: 'The Big D', image: figma('dallas.jpg') },
];

const parsePrice = (priceStr) => {
    // "Start at ₹ 60,000/Person"
    if (!priceStr) return 0;
    const match = priceStr.replace(/,/g, '').match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
};

const destinations = [];
let idx = 1;

const addSet = (arr, tags, region) => {
    arr.forEach(item => {
        destinations.push({
            id: `dest-${idx++}`,
            name: item.name || item.title,
            description: item.subtitle || "",
            image_url: item.image,
            base_price: item.price ? parsePrice(item.price) : 50000,
            region: region || "Global",
            tags: tags
        });
    });
};

addSet(POPULAR_DESTINATIONS, ["Popular"], "Global");
addSet(BEYOND_TOURIST_TRAIL, ["Beyond Tourist Trail"], "Global");
addSet(TOP_RATED_TRIPS, ["Top Rated"], "Global");
addSet(UNIQUE_EXPERIENCE_TRIPS, ["Unique Experience"], "Global");
addSet(MIDDLE_EAST_TRIPS, ["Middle East"], "Middle East");
addSet(TRENDING_EUROPE, ["Trending Europe"], "Europe");
addSet(SOUTH_EAST_ASIA_TRIPS, ["South East Asia"], "Asia");
addSet(UNITED_STATES_TRIPS, ["United States"], "North America");

const data = { destinations };
fs.writeFileSync('seed_data.json', JSON.stringify(data, null, 2));
