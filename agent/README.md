# FUT App Programming Agent

This document outlines the process for managing the FUT app, including development with Expo, version control with Git, and building with EAS.

## 1. Development with Expo

The FUT app is built with React Native and Expo. To start the development server, run the following command in the `FUT` directory:

```bash
npx expo start
```

This will start the Metro bundler and provide you with a QR code to run the app on your device using the Expo Go app.

## 2. Version Control with Git and GitHub

This project uses Git for version control and GitHub for remote repository hosting.

### Committing Changes

To commit changes to the local repository, use the following commands:

```bash
# Stage all changes
git add .

# Commit the changes with a message
git commit -m "Your commit message here"
```

### Pushing Changes to GitHub

To push your local commits to the remote GitHub repository, use the following command:

```bash
git push origin main
```

(Assuming you are working on the `main` branch).

## 3. Building with Expo Application Services (EAS)

EAS is used to build and submit the app to the app stores.

### Prerequisites

Before you can build the app, you need to have the EAS CLI installed and configured.

```bash
# Install the EAS CLI
npm install -g eas-cli

# Log in to your Expo account
eas login
```

You also need to configure the `eas.json` file in the root of the `FUT` project. This file defines the build profiles for different environments (e.g., development, production).

### Creating a Build

To create a new build, use the following command:

```bash
# Start a build for Android
eas build --platform android
```

This will start a new build on the EAS servers. You can monitor the build progress on the Expo website.

### Submitting the Build

Once the build is complete, you can download the `.apk` or `.aab` file and submit it to the Google Play Store.

EAS can also automate the submission process. To submit your app to the Google Play Store, you can use the following command:

```bash
eas submit --platform android
```

This will guide you through the submission process.

## Automation Scripts

To simplify the development and build process, you can create shell scripts to automate the commands above. For example, you could create a `build.sh` script to automate the build and submission process.
