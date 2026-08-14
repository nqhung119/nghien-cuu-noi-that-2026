param(
    [string]$SourceRoot = (Join-Path $PSScriptRoot '..\..\NOI-THAT-CAN-HO-MAU')
)

$ErrorActionPreference = 'Stop'
$SourceRoot = (Resolve-Path -LiteralPath $SourceRoot).Path
$managementDirectory = Join-Path $SourceRoot '00-QUAN-LY-DU-AN'
$items = @(Import-Csv -LiteralPath (Join-Path $managementDirectory '09-DANH-MUC-HANG-MUC.csv'))
$knowledge = Get-Content -Raw -Encoding UTF8 (Join-Path $managementDirectory '12-HUONG-DAN-HANG-MUC.json') | ConvertFrom-Json
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$startMarker = '<!-- GUIDE:START -->'
$endMarker = '<!-- GUIDE:END -->'

function Get-PropertyValue($Object, [string]$Name) {
    if ($null -eq $Object) { return $null }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) { return $null }
    return $property.Value
}

function New-GuideMarkdown($Item, $Guide, $TypeGuide) {
    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add($startMarker)
    $lines.Add('## Giới thiệu và vai trò')
    $lines.Add('')
    $lines.Add([string]$Guide.intro)
    $lines.Add('')
    $lines.Add("- **Vị trí trong căn hộ:** $($Guide.location)")
    $lines.Add("- **Có bắt buộc không:** $($Guide.mandatory)")
    $lines.Add("- **Nhóm hạng mục:** $($TypeGuide.label)")
    $lines.Add('')
    $lines.Add('## Các loại phổ biến và vật liệu')
    $lines.Add('')
    $lines.Add("- **Loại/giải pháp thường gặp:** $($Guide.commonTypes)")
    $lines.Add("- **Vật liệu và cấu tạo cần nhận biết:** $($Guide.materials)")
    $lines.Add('')
    $lines.Add('## Chi phí hình thành như thế nào?')
    $lines.Add('')
    $lines.Add([string]$Guide.priceFactors)
    $lines.Add('')
    $lines.Add('> Khoảng giá trong bảng là dữ liệu lập ngân sách. Khi lấy báo giá phải khóa cùng kích thước, vật liệu, phụ kiện, phạm vi lắp đặt, vận chuyển, thuế và bảo hành để so sánh công bằng.')
    $lines.Add('')
    $lines.Add('## Vệ sinh, bảo trì và tuổi thọ sử dụng')
    $lines.Add('')
    $lines.Add([string]$TypeGuide.maintenance)
    $lines.Add('')
    $lines.Add('Tuổi thọ của từng phương án được ghi trong bảng so sánh khi có dữ liệu; đó là khoảng sử dụng hợp lý khi lắp đúng và bảo trì phù hợp, không phải thời hạn bảo hành.')
    $lines.Add('')
    $lines.Add('## Thi công và nghiệm thu')
    $lines.Add('')
    $lines.Add("- **Trước khi làm:** $($TypeGuide.installation)")
    $lines.Add("- **Khi nghiệm thu:** $($TypeGuide.inspection)")
    $lines.Add('')
    $lines.Add('## Lỗi thường gặp')
    $lines.Add('')
    $lines.Add([string]$Guide.pitfalls)
    $lines.Add('')
    $lines.Add('## Khuyến nghị cho căn hộ mẫu')
    $lines.Add('')
    $lines.Add([string]$Guide.recommendation)
    $lines.Add('')
    $lines.Add($endMarker)
    return $lines -join "`n"
}

$updated = 0
foreach ($item in $items) {
    $guide = Get-PropertyValue $knowledge.items $item.item_id
    if ($null -eq $guide) { throw "Thiếu hướng dẫn cho $($item.item_id)" }
    $typeGuide = Get-PropertyValue $knowledge.typeGuides $item.type
    if ($null -eq $typeGuide) { throw "Thiếu hướng dẫn loại $($item.type)" }

    $readmePath = Join-Path $SourceRoot (($item.folder -replace '/', '\') + '\README.md')
    if (-not (Test-Path -LiteralPath $readmePath)) { throw "Không tìm thấy $readmePath" }
    $markdown = [IO.File]::ReadAllText($readmePath, [Text.Encoding]::UTF8)
    $markdown = [regex]::Replace(
        $markdown,
        '(?s)\r?\n?<!-- GUIDE:START -->.*?<!-- GUIDE:END -->\r?\n?',
        "`n`n"
    ).TrimEnd()

    $headingMatch = [regex]::Match($markdown, '(?m)^#\s+.+$')
    if (-not $headingMatch.Success) { throw "README không có H1: $readmePath" }
    $insertAt = $headingMatch.Index + $headingMatch.Length
    $guideMarkdown = New-GuideMarkdown $item $guide $typeGuide
    $result = $markdown.Substring(0, $insertAt) + "`n`n" + $guideMarkdown + "`n`n" + $markdown.Substring($insertAt).TrimStart()
    [IO.File]::WriteAllText($readmePath, $result.TrimEnd() + "`n", $utf8NoBom)
    $updated += 1
}

Write-Host "Enriched category README files: $updated"
