#!/bin/bash

# Simple package script for Summons for PF1e module
# Creates a zip file ready for distribution

MODULE_NAME="summons-for-pf1e"
VERSION=$(grep '"version"' module.json | sed 's/.*"version": "\(.*\)".*/\1/')

echo "Packaging ${MODULE_NAME} v${VERSION}..."

# Create a temporary directory
TEMP_DIR="dist/${MODULE_NAME}"
mkdir -p "${TEMP_DIR}"

# Copy files
echo "Copying files..."
cp -r scripts "${TEMP_DIR}/"
cp -r styles "${TEMP_DIR}/"
cp -r lang "${TEMP_DIR}/"
cp module.json "${TEMP_DIR}/"
cp README.md "${TEMP_DIR}/"
cp CHANGELOG.md "${TEMP_DIR}/"
cp LICENSE "${TEMP_DIR}/" 2>/dev/null || echo "No LICENSE file found, skipping..."

# Create zip
cd dist
zip -r "${MODULE_NAME}-v${VERSION}.zip" "${MODULE_NAME}"
cd ..

echo "Package created: dist/${MODULE_NAME}-v${VERSION}.zip"
echo "Done!"
