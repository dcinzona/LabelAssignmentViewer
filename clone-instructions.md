# Cloning Instructions

To clone this project locally, follow these steps:

## Option 1: Using GitHub, GitLab, or Bitbucket

1. Create a new repository on your preferred Git hosting service (GitHub, GitLab, Bitbucket)
2. Follow their instructions for "push an existing repository"
3. Use these commands after creating the repository (replace the URL with your repository URL):

```bash
git remote add origin https://github.com/yourusername/LabelAssignmentViewer.git
git branch -M main
git add .
git commit -m "Initial commit"
git push -u origin main
```

4. Then clone to your local machine:

```bash
git clone https://github.com/yourusername/LabelAssignmentViewer.git
cd LabelAssignmentViewer
```

## Option 2: Direct Download

If you prefer not to use a Git hosting service:

1. In Replit, click on the three dots next to Files
2. Select "Download as zip"
3. Extract the zip file to your local machine
4. Initialize a local Git repository:

```bash
cd path/to/extracted/folder
git init
git add .
git commit -m "Initial commit"
```

## Next Steps After Cloning

Once you have the project locally:

1. Authorize your Salesforce org:
   ```bash
   sf org login web
   ```
   
2. Deploy to your org:
   ```bash
   sf project deploy start
   ```
   
3. Or create a scratch org and push:
   ```bash
   sf org create scratch -f config/project-scratch-def.json -a MyScratch
   sf project deploy start
   ```