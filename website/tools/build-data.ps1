param(
    [string]$SourceRoot = (Join-Path $PSScriptRoot '..\..\NOI-THAT-CAN-HO-MAU'),
    [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\data')
)

$ErrorActionPreference = 'Stop'
$SourceRoot = (Resolve-Path -LiteralPath $SourceRoot).Path
$OutputDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$sourceUri = [Uri]($SourceRoot.TrimEnd('\') + '\')

function Get-RelativeSourcePath([string]$FullPath) {
    $fileUri = [Uri]$FullPath
    return [Uri]::UnescapeDataString($sourceUri.MakeRelativeUri($fileUri).ToString())
}

function Get-Slug([string]$Value) {
    if ([string]::IsNullOrWhiteSpace($Value)) { return 'muc' }
    $valueLower = $Value.ToLowerInvariant().Replace([char]0x0111, 'd').Replace([char]0x0110, 'd')
    $normalized = $valueLower.Normalize([Text.NormalizationForm]::FormD)
    $builder = New-Object Text.StringBuilder
    foreach ($char in $normalized.ToCharArray()) {
        $category = [Globalization.CharUnicodeInfo]::GetUnicodeCategory($char)
        if ($category -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
            [void]$builder.Append($char)
        }
    }
    $slug = $builder.ToString().Normalize([Text.NormalizationForm]::FormC)
    $slug = $slug -replace '[^a-z0-9]+', '-'
    $slug = $slug.Trim('-')
    if ([string]::IsNullOrWhiteSpace($slug)) { return 'muc' }
    return $slug
}

function Get-MarkdownTitle([string]$Markdown, [string]$Fallback) {
    $match = [regex]::Match($Markdown, '(?m)^#\s+(.+?)\s*$')
    if (-not $match.Success) { return $Fallback }
    $title = $match.Groups[1].Value.Trim()
    $title = $title -replace '^\d+\s*[\u2013\u2014-]\s*', ''
    $title = $title -replace '^[A-Z0-9-]+\s*[\u2013\u2014]\s*', ''
    return $title.Trim()
}

function Get-PlainText([string]$Markdown) {
    $text = $Markdown
    $text = [regex]::Replace($text, '```[\s\S]*?```', ' ')
    $text = [regex]::Replace($text, '!\[([^\]]*)\]\([^)]*\)', '$1')
    $text = [regex]::Replace($text, '\[([^\]]+)\]\([^)]*\)', '$1')
    $text = $text -replace '[#>*_`|\-]+', ' '
    $text = $text -replace '\s+', ' '
    return $text.Trim()
}

function Split-MarkdownTableRow([string]$Line) {
    $trimmed = $Line.Trim()
    if ($trimmed.StartsWith('|')) { $trimmed = $trimmed.Substring(1) }
    if ($trimmed.EndsWith('|')) { $trimmed = $trimmed.Substring(0, $trimmed.Length - 1) }
    return @($trimmed.Split('|') | ForEach-Object { $_.Trim() })
}

function Get-OptionTableRows([string]$Markdown) {
    $result = @{}
    $lines = $Markdown -split "`r?`n"
    for ($index = 0; $index -lt $lines.Count - 2; $index++) {
        if (-not $lines[$index].Trim().StartsWith('|')) { continue }
        $headers = Split-MarkdownTableRow $lines[$index]
        if ($headers.Count -lt 2) { continue }
        if ($headers[0] -notmatch '^M') { continue }
        if ($lines[$index + 1] -notmatch '^\s*\|?\s*:?-+') { continue }

        for ($rowIndex = $index + 2; $rowIndex -lt $lines.Count; $rowIndex++) {
            $line = $lines[$rowIndex]
            if (-not $line.Trim().StartsWith('|')) { break }
            $cells = Split-MarkdownTableRow $line
            if ($cells.Count -eq 0 -or [string]::IsNullOrWhiteSpace($cells[0])) { continue }
            $row = [ordered]@{}
            for ($column = 0; $column -lt $headers.Count; $column++) {
                $value = if ($column -lt $cells.Count) { $cells[$column] } else { '' }
                $row[$headers[$column]] = $value
            }
            $result[$cells[0]] = $row
        }
    }
    return $result
}

function Get-OptionNameFromCells($Cells, [string]$Fallback) {
    if ($null -eq $Cells) { return $Fallback }
    $keys = @($Cells.Keys)
    if ($keys.Count -gt 1) {
        $value = [string]$Cells[$keys[1]]
        if (-not [string]::IsNullOrWhiteSpace($value)) { return $value }
    }
    return $Fallback
}

function New-MarkdownDocument(
    [string]$GroupId,
    [IO.FileInfo]$File,
    [string]$Kind = 'markdown',
    [string]$ItemId = '',
    $ItemRecord = $null,
    $OptionRecords = @(),
    $Guide = $null
) {
    $markdown = [IO.File]::ReadAllText($File.FullName, [Text.Encoding]::UTF8)
    $relativePath = Get-RelativeSourcePath $File.FullName
    $fallback = [IO.Path]::GetFileNameWithoutExtension($File.Name)
    $title = Get-MarkdownTitle $markdown $fallback
    $idBase = if ($ItemId) { $ItemId.ToLowerInvariant() } else { Get-Slug ($GroupId + '-' + $relativePath) }

    return [pscustomobject][ordered]@{
        id = $idBase
        groupId = $GroupId
        kind = $Kind
        title = $title
        path = $relativePath
        sourceHref = '../NOI-THAT-CAN-HO-MAU/' + $relativePath
        markdown = $markdown
        plainText = Get-PlainText $markdown
        itemId = $ItemId
        itemType = if ($ItemRecord) { $ItemRecord.type } else { '' }
        scope = if ($ItemRecord) { $ItemRecord.scope } else { '' }
        phaseB = if ($ItemRecord) { $ItemRecord.phase_b_150m } else { '' }
        optionIds = @($OptionRecords | ForEach-Object { $_.id })
        guide = $Guide
    }
}

function New-CsvDocument([string]$GroupId, [IO.FileInfo]$File) {
    $relativePath = Get-RelativeSourcePath $File.FullName
    $records = @(Import-Csv -LiteralPath $File.FullName)
    $headers = if ($records.Count -gt 0) { @($records[0].PSObject.Properties.Name) } else { @() }
    $rows = @()
    foreach ($record in $records) {
        $row = [ordered]@{}
        foreach ($header in $headers) { $row[$header] = [string]$record.$header }
        $rows += [pscustomobject]$row
    }
    $title = [IO.Path]::GetFileNameWithoutExtension($File.Name)
    $title = $title -replace '^\d+-', ''
    $title = ($title -replace '-', ' ').Trim()
    $searchText = (($headers -join ' ') + ' ' + (($rows | ForEach-Object { ($_.PSObject.Properties.Value -join ' ') }) -join ' ')).Trim()

    return [pscustomobject][ordered]@{
        id = Get-Slug ($GroupId + '-' + $relativePath)
        groupId = $GroupId
        kind = 'csv'
        title = $title
        path = $relativePath
        sourceHref = '../NOI-THAT-CAN-HO-MAU/' + $relativePath
        markdown = ''
        plainText = $searchText
        itemId = ''
        itemType = 'DATA'
        scope = 'Data table'
        phaseB = ''
        optionIds = @()
        csvHeaders = $headers
        csvRows = $rows
    }
}

$managementDirectory = Join-Path $SourceRoot '00-QUAN-LY-DU-AN'
$items = @(Import-Csv -LiteralPath (Join-Path $managementDirectory '09-DANH-MUC-HANG-MUC.csv'))
$optionRows = @(Import-Csv -LiteralPath (Join-Path $managementDirectory '10-DANH-MUC-PHUONG-AN.csv'))
$brandRows = @(Import-Csv -LiteralPath (Join-Path $managementDirectory '11-NHOM-THUONG-HIEU.csv'))
$knowledgePath = Join-Path $managementDirectory '12-HUONG-DAN-HANG-MUC.json'
$knowledge = Get-Content -Raw -Encoding UTF8 $knowledgePath | ConvertFrom-Json

function Get-KnowledgeProperty($Object, [string]$Name) {
    if ($null -eq $Object) { return $null }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) { return $null }
    return $property.Value
}

$guidesByItem = @{}
foreach ($item in $items) {
    $itemGuide = Get-KnowledgeProperty $knowledge.items $item.item_id
    if ($null -eq $itemGuide) { throw "Missing item guide: $($item.item_id)" }
    $typeGuide = Get-KnowledgeProperty $knowledge.typeGuides $item.type
    if ($null -eq $typeGuide) { throw "Missing type guide: $($item.type)" }
    $figure = Get-KnowledgeProperty $knowledge.figures ([string]$itemGuide.figure)
    if ($null -eq $figure) { throw "Missing figure '$($itemGuide.figure)' for $($item.item_id)" }

    $guidesByItem[$item.item_id] = [pscustomobject][ordered]@{
        intro = $itemGuide.intro
        location = $itemGuide.location
        mandatory = $itemGuide.mandatory
        commonTypes = $itemGuide.commonTypes
        materials = $itemGuide.materials
        priceFactors = $itemGuide.priceFactors
        pitfalls = $itemGuide.pitfalls
        recommendation = $itemGuide.recommendation
        typeLabel = $typeGuide.label
        maintenance = $typeGuide.maintenance
        installation = $typeGuide.installation
        inspection = $typeGuide.inspection
        figure = $figure
    }
}

$brandsByItem = @{}
foreach ($brand in $brandRows) { $brandsByItem[$brand.item_id] = $brand }

$itemById = @{}
foreach ($item in $items) { $itemById[$item.item_id] = $item }

$options = New-Object System.Collections.Generic.List[object]
$optionsByItem = @{}
$markdownCache = @{}

foreach ($row in $optionRows) {
    $item = $itemById[$row.item_id]
    $sourceFile = Join-Path $SourceRoot ($row.source_file -replace '/', '\')
    if (-not $markdownCache.ContainsKey($sourceFile)) {
        $sourceMarkdown = [IO.File]::ReadAllText($sourceFile, [Text.Encoding]::UTF8)
        $markdownCache[$sourceFile] = [pscustomobject]@{
            Markdown = $sourceMarkdown
            Rows = Get-OptionTableRows $sourceMarkdown
        }
    }
    $tableCells = $markdownCache[$sourceFile].Rows[$row.option_id]
    $brand = $brandsByItem[$row.item_id]
    $cellObject = [ordered]@{}
    if ($tableCells) {
        foreach ($key in $tableCells.Keys) { $cellObject[$key] = $tableCells[$key] }
    }
    $option = [pscustomobject][ordered]@{
        id = $row.option_id
        itemId = $row.item_id
        room = $row.room
        segment = $row.segment
        name = Get-OptionNameFromCells $tableCells $row.name
        normalizedName = $row.name
        priceMin = [double]$row.price_min
        priceMax = [double]$row.price_max
        priceBasis = $row.price_basis
        recommended = ($row.recommended -eq 'YES')
        sourceFile = $row.source_file
        cells = [pscustomobject]$cellObject
        brandGroups = if ($brand) {
            [pscustomobject][ordered]@{
                economy = $brand.economy_or_local
                mainstream = $brand.mainstream
                upper = $brand.upper_or_specialist
                note = $brand.selection_note
            }
        } else { $null }
        searchText = (($row.option_id, $row.item_id, $row.segment, $row.name, ($cellObject.Values -join ' '), $brand.economy_or_local, $brand.mainstream, $brand.upper_or_specialist) -join ' ')
    }
    $options.Add($option)
    if (-not $optionsByItem.ContainsKey($row.item_id)) { $optionsByItem[$row.item_id] = New-Object System.Collections.Generic.List[object] }
    $optionsByItem[$row.item_id].Add($option)
}

$documents = New-Object System.Collections.Generic.List[object]
$groups = New-Object System.Collections.Generic.List[object]
$usedMarkdown = @{}

function Add-DocumentToList($Document) {
    $documents.Add($Document)
    if ($Document.path) { $usedMarkdown[$Document.path.ToLowerInvariant()] = $true }
}

# Home / overview
$rootReadme = Get-Item -LiteralPath (Join-Path $SourceRoot 'README.md')
$homeDoc = New-MarkdownDocument 'home' $rootReadme 'home'
$homeDoc.id = 'home'
Add-DocumentToList $homeDoc
$groups.Add([pscustomobject][ordered]@{
    id = 'home'; title = $homeDoc.title; kind = 'home'; order = -1; overviewId = 'home'; documentIds = @('home')
})

# Project management group
$managementReadme = Get-Item -LiteralPath (Join-Path $managementDirectory 'README.md')
$managementOverview = New-MarkdownDocument 'management' $managementReadme 'overview'
$managementOverview.id = 'management-overview'
Add-DocumentToList $managementOverview
$managementIds = New-Object System.Collections.Generic.List[string]
$managementIds.Add($managementOverview.id)

Get-ChildItem -LiteralPath $managementDirectory -File | Where-Object { $_.Name -ne 'README.md' } | Sort-Object Name | ForEach-Object {
    if ($_.Extension -eq '.md') {
        $doc = New-MarkdownDocument 'management' $_ 'markdown'
        Add-DocumentToList $doc
        $managementIds.Add($doc.id)
    } elseif ($_.Extension -eq '.csv') {
        $doc = New-CsvDocument 'management' $_
        Add-DocumentToList $doc
        $managementIds.Add($doc.id)
    }
}
$groups.Add([pscustomobject][ordered]@{
    id = 'management'; title = $managementOverview.title; kind = 'management'; order = 0; overviewId = $managementOverview.id; documentIds = $managementIds.ToArray()
})

# Room and shared-item groups; detect every newly numbered directory.
$areaDirectories = @(Get-ChildItem -LiteralPath $SourceRoot -Directory | Where-Object {
    $_.Name -match '^\d{2}-' -and $_.Name -notmatch '^(00|90)-'
} | Sort-Object Name)

foreach ($areaDirectory in $areaDirectories) {
    $order = [int]$areaDirectory.Name.Substring(0, 2)
    $groupId = Get-Slug $areaDirectory.Name
    $overviewFile = Join-Path $areaDirectory.FullName 'README.md'
    $documentIds = New-Object System.Collections.Generic.List[string]
    $overviewId = ''
    $groupTitle = ($areaDirectory.Name -replace '^\d{2}-', '' -replace '-', ' ')

    if (Test-Path -LiteralPath $overviewFile) {
        $overviewDoc = New-MarkdownDocument $groupId (Get-Item -LiteralPath $overviewFile) 'overview'
        $overviewDoc.id = $groupId + '-overview'
        $groupTitle = $overviewDoc.title
        Add-DocumentToList $overviewDoc
        $documentIds.Add($overviewDoc.id)
        $overviewId = $overviewDoc.id
    }

    $areaItems = @($items | Where-Object { $_.folder -like ($areaDirectory.Name + '/*') } | Sort-Object folder)
    foreach ($item in $areaItems) {
        $itemReadmePath = Join-Path $SourceRoot (($item.folder -replace '/', '\') + '\README.md')
        if (-not (Test-Path -LiteralPath $itemReadmePath)) { continue }
        $itemOptions = if ($optionsByItem.ContainsKey($item.item_id)) { $optionsByItem[$item.item_id].ToArray() } else { @() }
        $itemDoc = New-MarkdownDocument $groupId (Get-Item -LiteralPath $itemReadmePath) 'category' $item.item_id $item $itemOptions $guidesByItem[$item.item_id]
        Add-DocumentToList $itemDoc
        $documentIds.Add($itemDoc.id)
    }

    # Include Markdown files that are not registered in the item catalog.
    Get-ChildItem -LiteralPath $areaDirectory.FullName -Recurse -Filter '*.md' -File | Sort-Object FullName | ForEach-Object {
        $relative = (Get-RelativeSourcePath $_.FullName).ToLowerInvariant()
        if ($usedMarkdown.ContainsKey($relative)) { return }
        $genericDoc = New-MarkdownDocument $groupId $_ 'markdown'
        Add-DocumentToList $genericDoc
        $documentIds.Add($genericDoc.id)
    }

    $groups.Add([pscustomobject][ordered]@{
        id = $groupId
        title = $groupTitle
        kind = if ($areaDirectory.Name -eq '08-HANG-MUC-CHUNG') { 'shared' } else { 'room' }
        order = $order
        overviewId = $overviewId
        documentIds = $documentIds.ToArray()
    })
}

# Attached records and all 90+ groups.
$recordDirectories = @(Get-ChildItem -LiteralPath $SourceRoot -Directory | Where-Object { $_.Name -match '^9\d-' } | Sort-Object Name)
foreach ($recordDirectory in $recordDirectories) {
    $groupId = Get-Slug $recordDirectory.Name
    $documentIds = New-Object System.Collections.Generic.List[string]
    $overviewId = ''
    $groupTitle = ($recordDirectory.Name -replace '^\d{2}-', '' -replace '-', ' ')
    $overviewFile = Join-Path $recordDirectory.FullName 'README.md'
    if (Test-Path -LiteralPath $overviewFile) {
        $doc = New-MarkdownDocument $groupId (Get-Item $overviewFile) 'overview'
        $doc.id = $groupId + '-overview'
        $groupTitle = $doc.title
        Add-DocumentToList $doc
        $documentIds.Add($doc.id)
        $overviewId = $doc.id
    }
    Get-ChildItem -LiteralPath $recordDirectory.FullName -Recurse -File | Where-Object { $_.FullName -ne $overviewFile } | Sort-Object FullName | ForEach-Object {
        if ($_.Extension -eq '.md') {
            $doc = New-MarkdownDocument $groupId $_ 'markdown'
            Add-DocumentToList $doc
            $documentIds.Add($doc.id)
        } elseif ($_.Extension -eq '.csv') {
            $doc = New-CsvDocument $groupId $_
            Add-DocumentToList $doc
            $documentIds.Add($doc.id)
        }
    }
    $groups.Add([pscustomobject][ordered]@{
        id = $groupId; title = $groupTitle; kind = 'records'; order = 90; overviewId = $overviewId; documentIds = $documentIds.ToArray()
    })
}

$payload = [pscustomobject][ordered]@{
    meta = [pscustomobject][ordered]@{
        title = 'Noi that can ho mau'
        subtitle = 'Interior and material selection database'
        project = 'Anonymized sample apartment'
        sourceRoot = 'NOI-THAT-CAN-HO-MAU'
        generatedAt = (Get-Date).ToString('o')
        groupCount = $groups.Count
        documentCount = $documents.Count
        itemCount = $items.Count
        optionCount = $options.Count
        knowledgeVersion = $knowledge.version
        knowledgeUpdated = $knowledge.updated
        knowledgeMethodNote = $knowledge.methodNote
    }
    groups = @($groups.ToArray() | Sort-Object order, title)
    documents = $documents.ToArray()
    options = $options.ToArray()
}

$json = $payload | ConvertTo-Json -Depth 30
[IO.File]::WriteAllText((Join-Path $OutputDirectory 'catalog.json'), $json, $utf8NoBom)
[IO.File]::WriteAllText((Join-Path $OutputDirectory 'catalog.js'), ('window.__KB_DATA__ = ' + $json + ';'), $utf8NoBom)

Write-Host "Generated knowledge base data"
Write-Host "Source:    $SourceRoot"
Write-Host "Groups:    $($payload.meta.groupCount)"
Write-Host "Documents: $($payload.meta.documentCount)"
Write-Host "Items:     $($payload.meta.itemCount)"
Write-Host "Options:   $($payload.meta.optionCount)"
Write-Host "Output:    $OutputDirectory"
