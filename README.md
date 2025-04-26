# Label Assignment Viewer

A Salesforce Lightning Web Component bundle that displays UserDefinedLabel records in a combobox and populates a datatable with related UserDefinedLabelAssignment records.

## Features

- Displays a combobox populated with UserDefinedLabel records
- Shows assignment counts for each label
- Renders assignment details in a datatable
- Special handling for Case records, displaying CaseNumber and Subject
- Search functionality to filter records
- Fully responsive design using SLDS patterns

## Installation

Deploy this component to your org using Salesforce DX:

```bash
sfdx force:source:deploy -p force-app
```

Or convert and deploy using the Metadata API:

```bash
sfdx force:source:convert -d mdapi_output
sfdx force:mdapi:deploy -d mdapi_output -w 100
```

## Usage

Add the component to any Lightning page through the Lightning App Builder.

## Technical Details

- Written in Lightning Web Components framework
- Uses wire service for reactive data loading
- Implements dynamic search filtering
- Special Case record handling using ID prefix detection (500)

## Local Development

1. Clone this repository
2. Connect to your dev org: `sfdx force:auth:web:login`
3. Push to your scratch org: `sfdx force:source:push`