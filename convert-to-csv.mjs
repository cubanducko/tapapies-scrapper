import { Parser } from "@json2csv/plainjs";
import fs from "fs";

const rawData = fs.readFileSync("./database/data.json");
const data = JSON.parse(rawData);

const opts = {
  fields: [
    {
      label: "Tapa",
      value: "tapa",
    },
    {
      label: "Descripción",
      value: "description",
    },
    {
      label: "Local",
      value: "place",
    },
    {
      label: "Nota",
      value: "rating",
    },
    {
      label: "Dirección",
      value: "address",
    },
    {
      label: "Google maps link",
      value: "url",
    },
    {
      label: "Apto para vegetarianos",
      value: (record) => {
        if (record.isVegetarian) {
          return "Si";
        } else if (record.isVegatarianOnDemand) {
          return "Bajo demanda";
        } else {
          return "No";
        }
      },
    },
    {
      label: "Apto para veganos",
      value: (record) => {
        if (record.isVegan) {
          return "Si";
        } else if (record.isVeganOnDemand) {
          return "Bajo demanda";
        } else {
          return "No";
        }
      },
    },
  ],
};

const parser = new Parser(opts);
const csv = parser.parse(data);

const filePath = "database/data.csv";

fs.writeFile(filePath, csv, (err) => {
  if (err) throw err;
  console.log(`CSV file has been saved to ${filePath}.`);
});
