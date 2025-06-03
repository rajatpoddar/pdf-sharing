
# Weekly Projects Hub

Weekly Projects Hub is a Next.js application designed for managing and distributing weekly project PDF documents. It features an admin panel for uploading and managing PDFs, including setting their download status (paid/due) and associating related persons. Users can browse, search, filter, and download available project PDFs.

## Features

*   **PDF Management**: Upload, view, and delete PDF documents.
*   **Status Control**: Mark PDFs as "paid" (downloadable) or "due" (locked).
*   **Related Persons**: Associate names with PDFs for better organization and searchability.
*   **User Dashboard**: Search, filter, and download PDFs.
*   **Admin Panel**: Secure section for managing all PDF uploads and settings.
    *   Access by typing "admin" in the user dashboard search bar.
*   **Responsive Design**: Adapts to different screen sizes, with a mobile-friendly interface.
*   **Light/Dark Mode**: Theme toggle for user preference.
*   **Dockerized Deployment**: Ready for deployment using Docker.

## Tech Stack

*   **Frontend**: Next.js (App Router), React, TypeScript
*   **UI**: ShadCN UI Components
*   **Styling**: Tailwind CSS, CSS Variables
*   **Deployment**: Docker

## Project Structure

```
├── data/                  # Persistent data (metadata.json)
├── public/                # Static assets & PDF uploads
│   └── uploads/
│       └── pdfs/
├── src/
│   ├── app/               # Next.js App Router (pages, layouts)
│   ├── components/        # React components (UI, specific features)
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utility functions, server actions, types
│   └── ...
├── Dockerfile             # Docker build instructions
├── next.config.ts         # Next.js configuration (ensure .ts is used)
├── package.json           # Project dependencies and scripts
└── ...
```

## Getting Started (Development)

### Prerequisites

*   Node.js (v18 or later recommended)
*   npm or yarn

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd <repository-name>
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Environment Variables:**
    *   The default admin password is hardcoded in `src/lib/config.ts`. For actual deployment, consider managing this via environment variables passed to your Docker container.

4.  **Run the development server:**
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:9002`.

### Admin Access

*   To access the admin panel, navigate to the main page and type "admin" into the search bar.
*   The default admin password is `adminpassword123` (configurable in `src/lib/config.ts`).

## Building for Production

To create an optimized production build:
```bash
npm run build
```
This will generate a production-ready application in the `.next` directory, and a standalone output in `.next/standalone/` due to the `output: 'standalone'` configuration in `next.config.ts`.

## Deployment with Docker (Example: Synology NAS)

This application is configured for Docker deployment.

### Prerequisites for Synology NAS Deployment

*   Docker package installed and running on your Synology NAS.
*   Docker installed locally (recommended for building the image).
*   Your project code pushed to a Git repository (e.g., GitHub).

### Step 1: Prepare Data Directories on Synology NAS

Create folders on your NAS to store persistent data:

*   **PDF Uploads Folder**: e.g., `/volume1/docker/weeklyprojectshub/uploads`
*   **Metadata Folder**: e.g., `/volume1/docker/weeklyprojectshub/data`

*(Replace paths with your preferred locations.)*

If you have existing data:
*   Copy `data/metadata.json` from your project to the NAS metadata folder.
*   Copy PDFs from `public/uploads/pdfs/` to the NAS PDF uploads folder.
*   If starting fresh, the application will attempt to create an empty `metadata.json` if the `data` volume is empty and permissions allow.

### Step 2: Build the Docker Image

You can build locally and push to a registry (like Docker Hub) or build locally and export/import.

**Build Locally & Push to Registry:**
1.  Navigate to your project directory.
2.  Build:
    ```bash
    docker build -t your-dockerhub-username/weeklyprojectshub:latest .
    ```
3.  Login to Docker Hub:
    ```bash
    docker login
    ```
4.  Push:
    ```bash
    docker push your-dockerhub-username/weeklyprojectshub:latest
    ```

### Step 3: Configure and Run Docker Container on Synology NAS

1.  Open the **Docker** package on your Synology NAS.
2.  Go to the **Image** tab.
    *   If pushed to a registry: Click "Add" > "Add from URL or Repository". Enter the image name (e.g., `your-dockerhub-username/weeklyprojectshub`) and choose the `latest` tag.
3.  Select your image and click **Launch**.
4.  **General Settings**:
    *   **Container Name**: e.g., `weekly-projects-hub`.
    *   Click **Advanced Settings**.
5.  **Advanced Settings**:
    *   **Volume Tab**:
        *   Add Folder 1:
            *   **File/Folder (NAS)**: `/volume1/docker/weeklyprojectshub/uploads` (your NAS path)
            *   **Mount path (Container)**: `/app/public/uploads/pdfs`
            *   Set to **Read/Write**.
        *   Add Folder 2:
            *   **File/Folder (NAS)**: `/volume1/docker/weeklyprojectshub/data` (your NAS path)
            *   **Mount path (Container)**: `/app/data`
            *   Set to **Read/Write**.
    *   **Port Settings Tab**:
        *   **Local Port**: Choose an available port on your NAS (e.g., `9002`).
        *   **Container Port**: `3000` (must match `EXPOSE` in Dockerfile).
        *   **Type**: TCP.
    *   **Enable auto-restart** (recommended).
6.  Click **Apply**, then **Next**, then **Apply** to start the container.

### Step 4: Access Your Application

Open your browser and navigate to:
`http://[Your-Synology-NAS-IP-Address]:[Local-Port-You-Chose]`
(e.g., `http://192.168.1.100:9002`)

## Scripts

*   `npm run dev`: Starts the Next.js development server with Turbopack on port 9002.
*   `npm run build`: Builds the application for production.
*   `npm run start`: Starts the Next.js production server (after building).
*   `npm run lint`: Runs Next.js ESLint.
*   `npm run typecheck`: Runs TypeScript type checking.

## Contributing

Feel free to open issues or submit pull requests if you have suggestions for improvements.
