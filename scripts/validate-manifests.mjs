#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');

const targets = [
  {
    name: 'music-index',
    schema: 'docs/schemas/music-index.schema.json',
    data: 'public/music-index.json'
  },
  {
    name: 'video-index',
    schema: 'docs/schemas/video-index.schema.json',
    data: 'public/video-index.json'
  },
  {
    name: 'download-index',
    schema: 'docs/schemas/download-index.schema.json',
    data: 'public/download-index.json'
  }
];

const readJson = async (relativePath) => {
  const filePath = path.resolve(projectRoot, relativePath);
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
};

const formatErrorPath = (instancePath) => instancePath || '/';

const main = async () => {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
    allowUnionTypes: true
  });
  addFormats(ajv);

  let hasFailure = false;

  for (const target of targets) {
    try {
      const [schemaJson, dataJson] = await Promise.all([
        readJson(target.schema),
        readJson(target.data)
      ]);

      const validate = ajv.compile(schemaJson);
      const valid = validate(dataJson);
      if (valid) {
        console.log(`OK   ${target.name}`);
        continue;
      }

      hasFailure = true;
      console.error(`FAIL ${target.name}`);
      for (const err of validate.errors || []) {
        const location = formatErrorPath(err.instancePath);
        const message = err.message || 'invalid value';
        console.error(`  - ${location} ${message}`);
      }
    } catch (error) {
      hasFailure = true;
      console.error(`FAIL ${target.name}`);
      console.error(`  - ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (hasFailure) {
    process.exitCode = 1;
    console.error('Manifest validation failed.');
    return;
  }

  console.log('Manifest validation passed.');
};

void main();
