const fs = require('fs-extra');
const path = require('path');
const config = require('../config');

class FileUtils {
  static async ensureDirectoryExists(dirPath) {
    try {
      await fs.ensureDir(dirPath);
      console.log(`Directory ensured: ${dirPath}`);
    } catch (error) {
      console.error(`Failed to create directory ${dirPath}:`, error.message);
      throw error;
    }
  }

  static async writeJsonLines(data, filename) {
    try {
      const outputDir = config.output.dir;
      await this.ensureDirectoryExists(outputDir);
      
      const filePath = path.join(outputDir, filename);
      const jsonLines = data.map(item => JSON.stringify(item)).join('\n');
      
      await fs.writeFile(filePath, jsonLines, 'utf8');
      console.log(`Data written to ${filePath} (${data.length} records)`);
      return filePath;
    } catch (error) {
      console.error(`Failed to write JSON lines to ${filename}:`, error.message);
      throw error;
    }
  }

  static async appendJsonLines(data, filename) {
    try {
      const outputDir = config.output.dir;
      await this.ensureDirectoryExists(outputDir);
      
      const filePath = path.join(outputDir, filename);
      const jsonLines = data.map(item => JSON.stringify(item)).join('\n');
      
      // Add newline at the beginning if file exists
      const fileExists = await fs.pathExists(filePath);
      const content = fileExists ? '\n' + jsonLines : jsonLines;
      
      await fs.appendFile(filePath, content, 'utf8');
      console.log(`Data appended to ${filePath} (${data.length} records)`);
      return filePath;
    } catch (error) {
      console.error(`Failed to append JSON lines to ${filename}:`, error.message);
      throw error;
    }
  }

  static async readJsonLines(filename) {
    try {
      const filePath = path.join(config.output.dir, filename);
      const content = await fs.readFile(filePath, 'utf8');
      
      if (!content.trim()) {
        return [];
      }
      
      const lines = content.trim().split('\n');
      const data = lines.map(line => JSON.parse(line));
      
      console.log(`Read ${data.length} records from ${filePath}`);
      return data;
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`File ${filename} does not exist, returning empty array`);
        return [];
      }
      console.error(`Failed to read JSON lines from ${filename}:`, error.message);
      throw error;
    }
  }

  static async deleteFile(filename) {
    try {
      const filePath = path.join(config.output.dir, filename);
      await fs.unlink(filePath);
      console.log(`File deleted: ${filePath}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`Failed to delete file ${filename}:`, error.message);
        throw error;
      }
    }
  }

  static async getFileStats(filename) {
    try {
      const filePath = path.join(config.output.dir, filename);
      const stats = await fs.stat(filePath);
      return {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        exists: true
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { exists: false };
      }
      throw error;
    }
  }
}

module.exports = FileUtils; 