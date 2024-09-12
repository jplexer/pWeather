require('dotenv').config();
const express = require('express');
const axios = require('axios');

const { find } = require('geo-tz')
const moment = require('moment-timezone');

const app = express();
const port = 3000;

const apiKey = process.env.WEATHER_API_KEY;

app.get('/heartbeat', (req, res) => {
    res.send({valid: true});
});

app.get('/api/v1/geocode/:latitude/:longitude', (req, res) => {
    const latitude = req.params.latitude;
    const longitude = req.params.longitude;
    const units = req.query.units || 'm';
    const language = req.query.language || 'en_US';

    var apiUnits

    switch (units) {
        case 'm':
            apiUnits = 'ca';
            break;
        case 'h':
            apiUnits = 'uk';
            break;
        case 'e':
            apiUnits = 'us';
            break;
        default:
            apiUnits = 'ca';
            break;
    }



    axios.get(`https://api.pirateweather.net/forecast/${apiKey}/${latitude},${longitude}?units=${apiUnits}`)
    .then((response) => {
        var weather = response.data;
        var conditions = generateConditions(latitude, longitude, units, language, weather);
        var forecast = generateForecast(latitude, longitude, units, language, weather);
    
        res.json(
            {
                "conditions":{
                    "data": conditions,
                    "errors": false
                },
                "fcstdaily7":{
                    "data": forecast,
                    "errors": false
                },
                "metadata": {
                    "transaction_id": Math.floor(Date.now() / 1000).toString(),
                    "version": 2
                }
            }
        );
    })
    .catch((error) => {
        console.error(error);
        res.send('Error');
    });
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});

function generateConditions(latitude, longitude, units, language, weather) {

    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const localdate = new Date();
    const weatherToday = weather.daily.data[0];

    var sunriseTime = weatherToday.sunriseTime;
    var sunsetTime = weatherToday.sunsetTime;
    var currentTime = weather.currently.time;

    var isDay = currentTime >= sunriseTime && currentTime < sunsetTime;
    var dayInd = isDay ? "D" : "N";

    var weathercase;

    switch (units) {
        case 'm':
            weathercase = "metric";
            break;
        case 'h':
            weathercase = "uk_hybrid";
            break;
        case 'e':
            weathercase = "imperial";
            break;
        default:
            weathercase = "metric";
            break;
    }

    var weathercaseContent ={
            "altimeter": weather.currently.pressure, //altimeter
            "ceiling": 5000, //not available, send placeholder
            "dewpt": Math.round(weather.currently.dewPoint),
            "feels_like": Math.round(weather.currently.apparentTemperature),
            "gust": Math.round(weather.currently.windGust),
            "hi": Math.round(calculateHeatIndex(weather.currently.temperature, weather.currently.humidity * 100)), //heat index
            "mslp": 1011, //mean sea level pressure, not needed
            "pchange": -1.69, //pressure change, not needed
            "precip_1hour": Math.round(weather.currently.precipIntensity * 100) / 100, //precipitation
            "precip_24hour": Math.round(weatherToday.precipIntensityMax * 100) / 100, //precipitation
            "precip_6hour": Math.round(weather.hourly.data[5].precipIntensity* 100) / 100, //precipitation
            "rh": weather.currently.humidity * 100, //relative humidity
            "snow_1hour": 0, //snow not provided, its just never snowing
            "snow_24hour": 0, //snow not provided, its just never snowing
            "snow_6hour": 0, //snow not provided, its just never snowing
            "temp": Math.round(weather.currently.temperature),
            "temp_change_24hour": 2, //temperature change in 24 hours
            "temp_max_24hour": Math.round(weatherToday.temperatureHigh),
            "temp_min_24hour": Math.round(weatherToday.temperatureLow),
            "vis": weather.currently.visibility,
            "wc": Math.round(calculateWindChill(weather.currently.temperature, weather.currently.windSpeed)), //wind chill
            "wspd": Math.round(weather.currently.windSpeed) //wind speed
          }

    var conditions = {"metadata": {
        "expire_time_gmt": weather.currently.time + 600,
        "language": language,
        "latitude": +latitude,
        "longitude": +longitude,
        "status_code": 200,
        "transaction_id": "lol!",
        "units": units,
        "version": "1"
      },
      "observation": {
        "class": "observation",
        "clds": weather.currently.summary,
        "day_ind": dayInd,
        "dow": daysOfWeek[localdate.getDay()],
        "expire_time_gmt": weather.currently.time + 600,
        "icon_code": getWeatherIcon(weather.currently.icon),
        "icon_extd": getWeatherIcon(weather.currently.icon) * 100,
        [weathercase]: weathercaseContent,
        "obs_qualifier_code": null,
        "obs_qualifier_severity": null,
        "obs_time": weather.currently.time,
        "phrase_12char": weather.currently.summary,
        "phrase_22char": weather.currently.summary,
        "phrase_32char": weather.currently.summary,
        "ptend_code": 2, //pressure tendency code
        "ptend_desc": "Falling", //pressure tendency description
        "uv_desc": "Moderate", //need to calculate somehow
        "uv_index": Math.round(weather.currently.uvIndex),
        "wdir": weather.currently.windBearing, //wind direction, just use 220 for now
        "wdir_cardinal": getCardinalDirection(weather.currently.windBearing) //wind direction cardinal, just use SW for now
      }
    }

    return conditions;
}

function generateForecast(latitude, longitude, units, language, weather) {
    var forecasts = [];

    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    for (const day of weather.daily.data) {
        var valid = new Date(day.time * 1000 + 25200);
        var expirationTime = day["time"] + 25200 + 86400;

        var timeZone = find(latitude, longitude)[0];

        function formatDate(date, timeZone) {
            const formattedDate = moment(date).tz(timeZone).format('YYYY-MM-DDTHH:mm:ssZ');
            return formattedDate.replace(/(\d{2}):(\d{2})$/, '$1$2');
        }

        var valid_local = formatDate(valid, timeZone);
        var local_sunrise = formatDate(new Date(day.sunriseTime * 1000), timeZone);
        var local_sunset = formatDate(new Date(day.sunsetTime * 1000), timeZone);

        var daypart = {
            "alt_daypart_name": daysOfWeek[valid.getDay()],
            "clds": day["cloudCover"] * 100,
            "day_ind": "D",
            "daypart_name": daysOfWeek[valid.getDay()], 
            "fcst_valid": day.time,
            "fcst_valid_local": valid_local,
            "golf_category": "boring sports",
            "hi": Math.round(calculateHeatIndex(day.temperatureHigh, day.humidity * 100)),
            "icon_code": getWeatherIcon(day.icon),
            "icon_extd": getWeatherIcon(day.icon) * 100,
            "long_daypart_name": daysOfWeek[valid.getDay()],
            "narrative": day.summary + ". High of " + day.temperatureHigh + "C. Powered by PirateWeather.",
            "phrase_12char": day.summary,
            "phrase_22char": day.summary,
            "phrase_32char": day.summary,
            "pop": day.precipProbability * 100,
            "precip_type": "rain",
            "qpf": Math.round(day.precipAccumulation * 100) / 100,
            "qualifier": "Cool.",
            "qualifier_code": "Q5053",
            "rh": day.humidity * 100, 
            "shortcast": day.summary,
            "snow_qpf": 0,
            "snow_range": "",
            "temp": Math.round(day["temperatureHigh"]),
            "temp_phrase": "High " + day["temperatureHigh"] + "C",
            "thunder_enum": 0,
            "thunder_enum_phrase": "No thunder",
            "uv_desc": "Moderate", //calculate somehow,
            "uv_index": Math.round(day["uvIndex"]),
            "uv_index_raw": Math.round(day["uvIndex"]),
            "wc": Math.round(calculateWindChill(day.temperatureHigh, day.windSpeed)),
            "wdir": Math.round(day["windBearing"]), //wind direction
            "wdir_cardinal": getCardinalDirection(day["windBearing"]), //wind direction cardinal
            "wind_phrase": "Winds " + getCardinalDirection(day["windBearing"]) + " at " + day["windSpeed"], //wind phrase
            "wspd": Math.round(day["windSpeed"])
        }

        var nightpart = {
            "alt_daypart_name": daysOfWeek[valid.getDay()] + " Night",
            "clds": day["cloudCover"] * 100,
            "day_ind": "D",
            "daypart_name": daysOfWeek[valid.getDay()] + " Night", 
            "fcst_valid": day.time,
            "fcst_valid_local": valid_local,
            "golf_category": "boring sports",
            "hi": Math.round(calculateHeatIndex(day.temperatureHigh, day.humidity * 100)),
            "icon_code": getWeatherIcon(day.icon),
            "icon_extd": getWeatherIcon(day.icon) * 100,
            "long_daypart_name": daysOfWeek[valid.getDay()],
            "narrative": day.summary + ". Low of " + day.temperatureLow + "C. Powered by PirateWeather.",
            "phrase_12char": day.summary,
            "phrase_22char": day.summary,
            "phrase_32char": day.summary,
            "pop": day.precipProbability * 100,
            "precip_type": "rain",
            "qpf": Math.round(day.precipAccumulation * 100) / 100,
            "qualifier": "Cool.",
            "qualifier_code": "Q5053",
            "rh": day.humidity * 100, 
            "shortcast": day.summary,
            "snow_qpf": 0,
            "snow_range": "",
            "temp": Math.round(day["temperatureLow"]),
            "temp_phrase": "Low " + day["temperatureLow"] + "C",
            "thunder_enum": 0,
            "thunder_enum_phrase": "No thunder",
            "uv_desc": "Moderate", //calculate somehow,
            "uv_index": Math.round(day["uvIndex"]),
            "uv_index_raw": Math.round(day["uvIndex"]),
            "wc": Math.round(calculateWindChill(day.temperatureHigh, day.windSpeed)),
            "wdir": Math.round(day["windBearing"]), //wind direction
            "wdir_cardinal": getCardinalDirection(day["windBearing"]), //wind direction cardinal
            "wind_phrase": "Winds " + getCardinalDirection(day["windBearing"]) + " at " + day["windSpeed"], //wind phrase
            "wspd": Math.round(day["windSpeed"])
        }
        forecasts.push({
                'class': 'fod_long_range_daily',
                'day': daypart,
                'dow': daysOfWeek[valid.getDay()],
                'expire_time_gmt': expirationTime,
                'fcst_valid': day['time'] + 25200,
                'fcst_valid_local': valid_local,
                'lunar_phase': "Waxing Crescent", //force
                'lunar_phase_code': "WXC", //force
                'lunar_phase_day': 6, //force
                'max_temp': Math.round(day['temperatureHigh']),
                'min_temp': Math.round(day['temperatureLow']),
                'moonrise': "2024-06-10T00:00:00+0200", //force
                'moonset': "2024-06-10T00:00:00+0200", //force
                'night': nightpart,
                'qpf': day['precipAccumulation'] * 100,
                'snow_qpf': 0,
                'sunrise': local_sunrise,
                'sunset': local_sunset,
            })
    }
    return {forecasts: forecasts};
}

function calculateHeatIndex(temperature, humidity) {
    let ntemperature = temperature;

    // Convert temperature to Fahrenheit if it's in Celsius
    if (temperature < 40) {
        ntemperature = (temperature * 9/5) + 32;
    }

    const T = ntemperature;
    const R = humidity;

    let heatIndex = -42.379 + 2.04901523 * T + 10.14333127 * R
        - 0.22475541 * T * R - 0.00683783 * T * T - 0.05481717 * R * R
        + 0.00122874 * T * T * R + 0.00085282 * T * R * R - 0.00000199 * T * T * R * R;

    // If temperature was in Celsius, convert back to Celsius
    if (temperature < 40) {
        heatIndex = (heatIndex - 32) * 5/9;
    }

    return heatIndex;
}

function calculateWindChill(temperature, windSpeed) {
    let ntemperature = temperature;
    // Convert temperature to Fahrenheit if it's in Celsius
    if (temperature < 40) {
        ntemperature = (temperature * 9/5) + 32;
    }

    const T = ntemperature;
    const V = windSpeed;

    var windChill = 35.74 + 0.6215 * T - 35.75 * Math.pow(V, 0.16) + 0.4275 * T * Math.pow(V, 0.16);

    //if temperature was in celcius, convert back to celcius
    if (temperature < 40) {
        windChill = (windChill - 32) * 5/9;
    }

    return windChill;
}

const WeatherIcon = {
    clear_day: 31,
    clear_night: 32,
    rain: 11,
    snow: 41,
    sleet: 35,
    wind: 26,
    fog: 27,
    cloudy: 28,
    partly_cloudy_day: 29,
    partly_cloudy_night: 30,
    hail: 0,
    thunderstorm: 1,
    tornado: 2
};

function getWeatherIcon(summary, isDay) {
    switch (summary.toLowerCase()) {
        case 'clear':
            return isDay ? WeatherIcon.clear_day : WeatherIcon.clear_night;
        case 'rain':
            return WeatherIcon.rain;
        case 'snow':
            return WeatherIcon.snow;
        case 'sleet':
            return WeatherIcon.sleet;
        case 'wind':
            return WeatherIcon.wind;
        case 'fog':
            return WeatherIcon.fog;
        case 'cloudy':
            return WeatherIcon.cloudy;
        case 'partly cloudy':
            return isDay ? WeatherIcon.partly_cloudy_day : WeatherIcon.partly_cloudy_night;
        case 'hail':
            return WeatherIcon.hail;
        case 'thunderstorm':
            return WeatherIcon.thunderstorm;
        case 'tornado':
            return WeatherIcon.tornado;
        default:
            return WeatherIcon.cloudy; // Default icon
    }
}

//translate wind bearing to cardinal direction
function getCardinalDirection(angle) {
    if (angle >= 0 && angle < 22.5) {
        return "N";
    } else if (angle >= 22.5 && angle < 67.5) {
        return "NE";
    } else if (angle >= 67.5 && angle < 112.5) {
        return "E";
    } else if (angle >= 112.5 && angle < 157.5) {
        return "SE";
    } else if (angle >= 157.5 && angle < 202.5) {
        return "S";
    } else if (angle >= 202.5 && angle < 247.5) {
        return "SW";
    } else if (angle >= 247.5 && angle < 292.5) {
        return "W";
    } else if (angle >= 292.5 && angle < 337.5) {
        return "NW";
    } else if (angle >= 337.5 && angle <= 360) {
        return "N";
    } else {
        return "Unknown";
    }
}