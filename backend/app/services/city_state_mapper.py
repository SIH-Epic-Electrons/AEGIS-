"""
City to State Mapper
Maps Indian cities to their states for AI prediction
"""

# City to State mapping for major Indian cities
CITY_TO_STATE = {
    # Maharashtra
    'Mumbai': 'Maharashtra',
    'Pune': 'Maharashtra',
    'Thane': 'Maharashtra',
    'Navi Mumbai': 'Maharashtra',
    'Nagpur': 'Maharashtra',
    'Aurangabad': 'Maharashtra',
    'Nashik': 'Maharashtra',
    'Solapur': 'Maharashtra',
    'Kalyan': 'Maharashtra',
    'Vasai': 'Maharashtra',
    'Andheri': 'Maharashtra',
    'Bandra': 'Maharashtra',
    'Kurla': 'Maharashtra',
    'Borivali': 'Maharashtra',
    'Dadar': 'Maharashtra',
    
    # Delhi
    'New Delhi': 'Delhi',
    'Dwarka': 'Delhi',
    'Rohini': 'Delhi',
    'Pitampura': 'Delhi',
    'Connaught Place': 'Delhi',
    'Nehru Place': 'Delhi',
    'Saket': 'Delhi',
    'Gurgaon': 'Haryana',
    'Noida': 'Uttar Pradesh',
    'Faridabad': 'Haryana',
    
    # Karnataka
    'Bangalore': 'Karnataka',
    'Mysore': 'Karnataka',
    'Hubli': 'Karnataka',
    'Mangalore': 'Karnataka',
    'Belgaum': 'Karnataka',
    'Laggere': 'Karnataka',
    'Koramangala': 'Karnataka',
    'Whitefield': 'Karnataka',
    'Indiranagar': 'Karnataka',
    
    # Tamil Nadu
    'Chennai': 'Tamil Nadu',
    'Coimbatore': 'Tamil Nadu',
    'Madurai': 'Tamil Nadu',
    'Tiruchirappalli': 'Tamil Nadu',
    'Salem': 'Tamil Nadu',
    'T.Nagar': 'Tamil Nadu',
    'Anna Nagar': 'Tamil Nadu',
    
    # Gujarat
    'Ahmedabad': 'Gujarat',
    'Surat': 'Gujarat',
    'Vadodara': 'Gujarat',
    'Rajkot': 'Gujarat',
    'Gandhinagar': 'Gujarat',
    'CG Road': 'Gujarat',
    
    # West Bengal
    'Kolkata': 'West Bengal',
    'Howrah': 'West Bengal',
    'Durgapur': 'West Bengal',
    'Asansol': 'West Bengal',
    'Park Street': 'West Bengal',
    
    # Rajasthan
    'Jaipur': 'Rajasthan',
    'Jodhpur': 'Rajasthan',
    'Kota': 'Rajasthan',
    'Bikaner': 'Rajasthan',
    'Ajmer': 'Rajasthan',
    
    # Uttar Pradesh
    'Lucknow': 'Uttar Pradesh',
    'Kanpur': 'Uttar Pradesh',
    'Agra': 'Uttar Pradesh',
    'Varanasi': 'Uttar Pradesh',
    'Allahabad': 'Uttar Pradesh',
    'Ghaziabad': 'Uttar Pradesh',
    
    # Telangana
    'Hyderabad': 'Telangana',
    'Warangal': 'Telangana',
    'Nizamabad': 'Telangana',
    'Hitech City': 'Telangana',
    'Secunderabad': 'Telangana',
    
    # Andhra Pradesh
    'Visakhapatnam': 'Andhra Pradesh',
    'Vijayawada': 'Andhra Pradesh',
    'Guntur': 'Andhra Pradesh',
    'Nellore': 'Andhra Pradesh',
    
    # Kerala
    'Kochi': 'Kerala',
    'Thiruvananthapuram': 'Kerala',
    'Kozhikode': 'Kerala',
    'Thrissur': 'Kerala',
    
    # Madhya Pradesh
    'Bhopal': 'Madhya Pradesh',
    'Indore': 'Madhya Pradesh',
    'Gwalior': 'Madhya Pradesh',
    'Jabalpur': 'Madhya Pradesh',
    
    # Punjab
    'Chandigarh': 'Punjab',
    'Ludhiana': 'Punjab',
    'Amritsar': 'Punjab',
    'Jalandhar': 'Punjab',
    
    # Haryana
    'Panipat': 'Haryana',
    'Ambala': 'Haryana',
    
    # Bihar
    'Patna': 'Bihar',
    'Gaya': 'Bihar',
    'Bhagalpur': 'Bihar',
    'Muzaffarpur': 'Bihar',
}


def get_state_from_city(city: str) -> str:
    """
    Get state name from city name.
    
    Args:
        city: City name
        
    Returns:
        State name, defaults to 'Maharashtra' if not found
    """
    if not city:
        return 'Maharashtra'
    
    # Try exact match first
    state = CITY_TO_STATE.get(city.strip())
    if state:
        return state
    
    # Try case-insensitive match
    city_lower = city.strip().lower()
    for city_key, state_value in CITY_TO_STATE.items():
        if city_key.lower() == city_lower:
            return state_value
    
    # Default to Maharashtra (most common in synthetic data)
    return 'Maharashtra'

