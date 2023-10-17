# Tapapies 2023 Web Scrapper

This is a web scrapper designed to extract data from the Tapapies 2023 Gastronomic Festival in Madrid. The scrapper leverages Playwright and Node.js to fetch data from the festival's official website and Google Maps.

## Usage

### Scraping Data

To initiate the scraping process, run the following command:

```bash
npm run scrape
```

This generates a JSON file in `database/data.json`

### Transforming Data to CSV

Once the data has been scraped, you can transform it to CSV format using the following command:

```bash
npm run transform-to-csv
```

This generates a CSV file in `database/data.csv`

## Issues

If you encounter any issues or have suggestions for improvements, please [submit them here](https://github.com/cubanducko/tapapies-2023-scrapper/issues).

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

For more information, visit the [repository](https://github.com/cubanducko/tapapies-2023-scrapper).
