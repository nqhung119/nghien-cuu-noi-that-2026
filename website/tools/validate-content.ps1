param(
    [string]$SourceRoot = (Join-Path $PSScriptRoot '..\..\NOI-THAT-CAN-HO-MAU'),
    [string]$WebsiteRoot = (Join-Path $PSScriptRoot '..')
)

$ErrorActionPreference = 'Stop'
$SourceRoot = (Resolve-Path -LiteralPath $SourceRoot).Path
$WebsiteRoot = (Resolve-Path -LiteralPath $WebsiteRoot).Path
$managementDirectory = Join-Path $SourceRoot '00-QUAN-LY-DU-AN'
$items = @(Import-Csv -LiteralPath (Join-Path $managementDirectory '09-DANH-MUC-HANG-MUC.csv'))
$options = @(Import-Csv -LiteralPath (Join-Path $managementDirectory '10-DANH-MUC-PHUONG-AN.csv'))
$knowledge = Get-Content -Raw -Encoding UTF8 (Join-Path $managementDirectory '12-HUONG-DAN-HANG-MUC.json') | ConvertFrom-Json
$requiredGuideFields = @('intro', 'location', 'mandatory', 'commonTypes', 'materials', 'priceFactors', 'pitfalls', 'recommendation', 'figure')
$requiredFigureFields = @('src', 'alt', 'caption', 'credit')

function Get-PropertyValue($Object, [string]$Name) {
    if ($null -eq $Object) { return $null }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) { return $null }
    return $property.Value
}

foreach ($item in $items) {
    $guide = Get-PropertyValue $knowledge.items $item.item_id
    if ($null -eq $guide) { throw "Missing guide: $($item.item_id)" }
    foreach ($field in $requiredGuideFields) {
        $value = Get-PropertyValue $guide $field
        if ([string]::IsNullOrWhiteSpace([string]$value)) { throw "Missing guide field: $($item.item_id).$field" }
    }

    $typeGuide = Get-PropertyValue $knowledge.typeGuides $item.type
    if ($null -eq $typeGuide) { throw "Missing type guide: $($item.type)" }
    $figure = Get-PropertyValue $knowledge.figures ([string]$guide.figure)
    if ($null -eq $figure) { throw "Missing figure: $($guide.figure)" }
    foreach ($field in $requiredFigureFields) {
        $value = Get-PropertyValue $figure $field
        if ([string]::IsNullOrWhiteSpace([string]$value)) { throw "Missing figure field: $($guide.figure).$field" }
    }
    $figurePath = Join-Path $WebsiteRoot ([string]$figure.src -replace '/', '\')
    if (-not (Test-Path -LiteralPath $figurePath)) { throw "Missing figure asset: $figurePath" }

    $readmePath = Join-Path $SourceRoot (($item.folder -replace '/', '\') + '\README.md')
    if (-not (Test-Path -LiteralPath $readmePath)) { throw "Missing item README: $readmePath" }
    $markdown = [IO.File]::ReadAllText($readmePath, [Text.Encoding]::UTF8)
    if ([regex]::Matches($markdown, '<!-- GUIDE:START -->').Count -ne 1 -or
        [regex]::Matches($markdown, '<!-- GUIDE:END -->').Count -ne 1) {
        throw "Invalid generated-guide markers: $readmePath"
    }
}

foreach ($option in $options) {
    $sourcePath = Join-Path $SourceRoot ($option.source_file -replace '/', '\')
    if (-not (Test-Path -LiteralPath $sourcePath)) { throw "Missing option source: $($option.option_id)" }
    $markdown = [IO.File]::ReadAllText($sourcePath, [Text.Encoding]::UTF8)
    $pattern = '(?m)^\|\s*' + [regex]::Escape($option.option_id) + '\s*\|'
    if (-not [regex]::IsMatch($markdown, $pattern)) { throw "Option row not found: $($option.option_id)" }
}

$catalogPath = Join-Path $WebsiteRoot 'data\catalog.json'
if (-not (Test-Path -LiteralPath $catalogPath)) { throw "Missing generated catalog: $catalogPath" }
$catalog = Get-Content -Raw -Encoding UTF8 $catalogPath | ConvertFrom-Json
if (@($catalog.options).Count -ne $options.Count) { throw 'Generated option count does not match source.' }
if ([int]$catalog.meta.itemCount -ne $items.Count) { throw 'Generated item count does not match source.' }

Write-Host "Content validation passed"
Write-Host "Items:   $($items.Count)"
Write-Host "Options: $($options.Count)"
Write-Host "Figures: $(@($knowledge.figures.PSObject.Properties).Count)"
