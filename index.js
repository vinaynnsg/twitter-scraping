const express = require('express');
const puppeteer = require('puppeteer');
const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const data = require("./config.json");
const axios = require('axios');

const app = express();
const PORT = 3000;

// Function to retrieve public IP address
async function getPublicIPAddress() {
    try {
        const response = await axios.get('https://api.ipify.org?format=json');
        return response.data.ip;
    } catch (error) {
        console.error('Error retrieving public IP address:', error);
        return null;
    }
}

// Proxy configuration
const proxyUrl = "http://bixhpklu-rotate:pzh2x1ifv1pj@p.webshare.io:80";

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.get('/run-puppeteer', async (req, res) => {
    try {
        // to Generate unique ID
        const uniqueID = uuidv4();

        // to Get current date and time
        const currentDate = new Date();
        const dateTime = currentDate.toISOString();

        //To Get public IP address
        const publicIP = await getPublicIPAddress();

        // Launch Puppeteer and navigate to Twitter
        const browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            // to Max  browser size
            args: ['--start-maximized'] 
        });
        const page = await browser.newPage();
        await page.goto('https://www.twitter.com/', { waitUntil: "networkidle2" });

        await page.waitForSelector('a[href="/login"]');
        await page.click('a[href="/login"]');

        await page.waitForSelector('input[name="text"]');
        await page.type('input[name="text"]', data.user, { delay: 110 });
        await page.keyboard.press('Enter');

        await page.waitForSelector('input[name="text"]');
        await page.type('input[name="text"]', data.username, { delay: 100 });
        await page.keyboard.press('Enter');

        await page.waitForSelector('input[name="password"]');
        await page.type('input[name="password"]', data.psw, { delay: 110 });
        await page.keyboard.press('Enter');

        await page.waitForNavigation({ waitUntil: "networkidle2" });

        // Wait for the trending topics section to get fully loaded
        await page.waitForSelector('section div[aria-label="Timeline: Trending now"]', { waitUntil: "networkidle2" });

        const trendingTopics = await page.$$eval('section div[aria-label="Timeline: Trending now"] div.css-146c3p1.r-bcqeeo.r-1ttztb7.r-qvutc0.r-37j5jr.r-a023e6.r-rjixqe.r-b88u0q.r-1bymd8e span', (elements) =>
            elements.map((e) => ({
                title: e.innerText
            }))
        );

        // Store the results in MongoDB
        const uri = "mongodb://localhost:27017";  
        const client = new MongoClient(uri);

        try {
            await client.connect();

            const database = client.db('scraped_data');
            const collection = database.collection('trending_topics');

            // Filter out duplicate titles
            const uniqueTrendingTopics = trendingTopics.filter((topic, index) =>
                trendingTopics.findIndex(t => t.title === topic.title) === index
            );

            // Store only unique trending topics in MongoDB,ip should be string
            const result = await collection.insertOne({
                uniqueID: uniqueID,
                trend1: uniqueTrendingTopics[0] || { title: 'N/A' },
                trend2: uniqueTrendingTopics[1] || { title: 'N/A' },
                trend3: uniqueTrendingTopics[2] || { title: 'N/A' },
                trend4: uniqueTrendingTopics[3] || { title: 'N/A' },
                trend5: uniqueTrendingTopics[4] || { title: 'N/A' },
                dateTime: dateTime,
                ipAddress: publicIP  
            });

            console.log('Document inserted with ID:', result.insertedId);

            // Send the result back to the client
            res.json({
                uniqueID: uniqueID,
                trendingTopics: uniqueTrendingTopics,
                dateTime: dateTime,
                ipAddress: publicIP
            });

        } catch (error) {
            console.error('Error:', error);
            res.status(500).send('Error occurred during MongoDB insertion.');
            return;  
        } finally {
            await browser.close();
            await client.close();
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error occurred during Puppeteer execution.');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
