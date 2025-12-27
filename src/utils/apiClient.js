const axios = require('axios');
const config = require('../config');

class ApiClient {
  constructor() {
    console.log(`Using API base URL: ${config.api.baseUrl}`);
    this.client = axios.create({
      baseURL: config.api.baseUrl,
      timeout: config.api.timeout,
      headers: {
        'Authorization': config.api.token,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`Making request to: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('Request error:', error.message);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        console.error('Response error:', error.response?.status, error.response?.statusText);
        return Promise.reject(error);
      }
    );
  }

  async makeGetRequest(url, options = {}) {
    const maxRetries = config.api.retryAttempts;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.get(url, options);
        return response.data;
      } catch (error) {
        lastError = error;
        console.warn(`GET Request attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          const delay = config.api.retryDelay * attempt;
          console.log(`Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(`GET Request failed after ${maxRetries} attempts: ${lastError.message}`);
  }

  async makePostRequest(url, data = {}) {
    const maxRetries = config.api.retryAttempts;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.post(url, data);
        return response.data;
      } catch (error) {

        let reply = null;
        if (error.response) {
          reply = JSON.stringify(error.response.data);
        }

        lastError = error;
        console.warn(`POST Request attempt ${attempt} failed:`, reply || error.message);
        
        if (attempt < maxRetries) {
          const delay = config.api.retryDelay * attempt;
          console.log(`Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(`POST Request failed after ${maxRetries} attempts: ${lastError.message}`);
  }

  async fetchPlayers(page = 1, perPage = config.pagination.defaultPerPage) {
    const url = `/players?page=${page}&per_page=${perPage}`;
    return await this.makeGetRequest(url);
  }

  async createUpdateRequest(body) {
    const url = `/player-update-requests`;
    return await this.makePostRequest(url, body);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ApiClient; 