import fs from 'fs';

export class CacheManager {

    constructor(filePath) {
        this.filePath = filePath;
        this.data = this.readData();
    }

    readData() {
        try {
            const rawData = fs.readFileSync(this.filePath);
            return JSON.parse(rawData);
        } catch (error) {
            console.warn("[Log]: No cache file found");
            return {};
        }
    }

    get(key) {
        return this.data[key];
    }

    updateKey(key, value) {
        this.data[key] = value;
        this.writeData();
    }

    writeData() {
        try {
            const jsonData = JSON.stringify(this.data, null, 2);
            fs.writeFileSync(this.filePath, jsonData);
        } catch (error) {
            console.error("Error writing data:", error);
        }
    }
}

