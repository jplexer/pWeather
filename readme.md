# pWeather

pWeather is a Pebble weather proxy written in JavaScript.

To use pWeather, you need to provide a valid weather API key from PirateWeather. Follow these steps to set it up:

1. Create a new file in the root directory of your project called `.env`.
2. Open the `.env` file and add the following line:
    ```
    WEATHER_API_KEY=YOUR_API_KEY
    ```
    Replace `YOUR_API_KEY` with your actual weather API key.
3. Save the `.env` file.

## Use with RWS

In order to use pWeather with Rebble Web Services:

1. Go to https://auth.rebble.io/account/
2. Go to the Bottom and click the "I know what I'm doing" button
3. In the text box put in this JSON:
    ```
    {
        "config" : {
 	        "weather": {
 	    	    "url": "http://[root]/api/v1/geocode/$$latitude$$/$$longitude$$/?language=$$language$$&units=$$units$$",
 	    	    "provider_name": "pWeather"
 	        }
        }
    }
    ```
    Replace `[root]` with the host of pWeather
4. Click the OK button
5. Redo the [boot sequence](https://boot.rebble.io)