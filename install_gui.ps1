param(
    [string]$Root,
    [string]$OutputPath
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$logoPath = Join-Path $Root 'public\images\MGIS-logo_azul.png'
$licensePath = Join-Path $Root 'LICENSE'

function Show-Warning($message) {
    [System.Windows.Forms.MessageBox]::Show(
        $message,
        'MGIS Installer',
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Warning
    ) | Out-Null
}

function Save-InstallerConfig {
    param(
        [bool]$Production,
        [string]$AppUrl,
        [string]$CorsOrigin,
        [string]$CesiumToken,
        [bool]$InstallService,
        [bool]$LicenseAccepted
    )

    $sessionSecret = New-RandomSecret
    $jwtSecret = New-RandomSecret

    $content = @(
        '# Environment mode',
        ('APP_ENV=' + $(if ($Production) { 'production' } else { 'development' })),
        'PORT=3000',
        ('TRUST_PROXY=' + $(if ($Production) { '1' } else { '0' })),
        '',
        ('APP_URL=' + $(if ($Production) { $AppUrl } else { 'http://localhost:3000' })),
        ('CORS_ORIGIN=' + $(if ($Production) { $CorsOrigin } else { 'http://localhost:3000' })),
        ('SESSION_COOKIE_SECURE=' + $(if ($Production) { 'true' } else { 'false' })),
        ('SESSION_COOKIE_SAME_SITE=' + $(if ($Production) { 'strict' } else { 'lax' })),
        '',
        ('SESSION_SECRET=' + $sessionSecret),
        ('JWT_SECRET=' + $jwtSecret),
        ('CESIUM_ION_TOKEN=' + $CesiumToken),
        ('INSTALL_SERVICE=' + $(if ($InstallService) { 'true' } else { 'false' })),
        ('LICENSE_ACCEPTED=' + $(if ($LicenseAccepted) { '1' } else { '0' }))
    ) -join [Environment]::NewLine

    Set-Content -LiteralPath $OutputPath -Value $content -Encoding ASCII
}

function Show-LicenseDialog {
    param([string]$LicenseText)

    $licenseForm = New-Object System.Windows.Forms.Form
    $licenseForm.Text = 'MGIS 3D-Planner License'
    $licenseForm.StartPosition = 'CenterParent'
    $licenseForm.Size = New-Object System.Drawing.Size(760, 540)
    $licenseForm.FormBorderStyle = 'SizableToolWindow'
    $licenseForm.MinimizeBox = $false
    $licenseForm.MaximizeBox = $false

    $introLabel = New-Object System.Windows.Forms.Label
    $introLabel.Text = 'Read the license text below. Close this window to return to the installer.'
    $introLabel.AutoSize = $true
    $introLabel.Location = New-Object System.Drawing.Point(12, 14)

    $licenseBox = New-Object System.Windows.Forms.RichTextBox
    $licenseBox.Location = New-Object System.Drawing.Point(12, 40)
    $licenseBox.Size = New-Object System.Drawing.Size(720, 420)
    $licenseBox.ReadOnly = $true
    $licenseBox.DetectUrls = $true
    $licenseBox.Text = $LicenseText
    $licenseBox.BackColor = [System.Drawing.Color]::White

    $closeButton = New-Object System.Windows.Forms.Button
    $closeButton.Text = 'Close'
    $closeButton.Size = New-Object System.Drawing.Size(100, 30)
    $closeButton.Location = New-Object System.Drawing.Point(632, 468)
    $closeButton.Add_Click({ $licenseForm.Close() })

    $licenseForm.Controls.AddRange(@($introLabel, $licenseBox, $closeButton))
    $licenseForm.ShowDialog() | Out-Null
}

function New-RandomSecret {
    return [Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
}

function New-FieldCard {
    param(
        [string]$Title,
        [string]$Description,
        [int]$X,
        [int]$Y,
        [int]$Width = 292,
        [string]$DefaultValue = '',
        [bool]$IsPassword = $false
    )

    $innerWidth = $Width - 20

    $panel = New-Object System.Windows.Forms.Panel
    $panel.Location = New-Object System.Drawing.Point($X, $Y)
    $panel.Size = New-Object System.Drawing.Size -ArgumentList $Width, 88
    $panel.BackColor = [System.Drawing.Color]::White
    $panel.BorderStyle = [System.Windows.Forms.BorderStyle]::FixedSingle

    $titleLabel = New-Object System.Windows.Forms.Label
    $titleLabel.Text = $Title
    $titleLabel.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 9)
    $titleLabel.AutoSize = $true
    $titleLabel.Location = New-Object System.Drawing.Point(10, 8)

    $descriptionLabel = New-Object System.Windows.Forms.Label
    $descriptionLabel.Text = $Description
    $descriptionLabel.ForeColor = [System.Drawing.Color]::FromArgb(88, 96, 110)
    $descriptionLabel.Location = New-Object System.Drawing.Point(10, 28)
    $descriptionLabel.Size = New-Object System.Drawing.Size -ArgumentList $innerWidth, 28

    $textBox = New-Object System.Windows.Forms.TextBox
    $textBox.Location = New-Object System.Drawing.Point(10, 58)
    $textBox.Size = New-Object System.Drawing.Size -ArgumentList $innerWidth, 24
    $textBox.Text = $DefaultValue
    if ($IsPassword) {
        $textBox.UseSystemPasswordChar = $true
    }

    $panel.Controls.AddRange(@($titleLabel, $descriptionLabel, $textBox))

    return [pscustomobject]@{
        Panel = $panel
        TextBox = $textBox
    }
}

$form = New-Object System.Windows.Forms.Form
$form.Text = 'MGIS 3D-Planner Setup'
$form.StartPosition = 'CenterScreen'
$form.Size = New-Object System.Drawing.Size(690, 690)
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.BackColor = [System.Drawing.Color]::FromArgb(245, 247, 250)
$form.Font = New-Object System.Drawing.Font('Segoe UI', 8.5)

$headerPanel = New-Object System.Windows.Forms.Panel
$headerPanel.Location = New-Object System.Drawing.Point(0, 0)
$headerPanel.Size = New-Object System.Drawing.Size(690, 96)
$headerPanel.BackColor = [System.Drawing.Color]::FromArgb(232, 240, 252)

$logoBox = New-Object System.Windows.Forms.PictureBox
$logoBox.Location = New-Object System.Drawing.Point(18, 14)
$logoBox.Size = New-Object System.Drawing.Size(156, 64)
$logoBox.SizeMode = [System.Windows.Forms.PictureBoxSizeMode]::Zoom
if (Test-Path -LiteralPath $logoPath) {
    $logoBox.Image = [System.Drawing.Image]::FromFile($logoPath)
}

$title = New-Object System.Windows.Forms.Label
$title.Text = 'MGIS 3D-Planner Installer'
$title.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 16)
$title.AutoSize = $true
$title.Location = New-Object System.Drawing.Point(190, 16)
$title.ForeColor = [System.Drawing.Color]::FromArgb(21, 64, 122)

$subtitle = New-Object System.Windows.Forms.Label
$subtitle.Text = 'Pick a deployment mode, complete the required fields, review the license, and continue.'
$subtitle.AutoSize = $true
$subtitle.MaximumSize = New-Object System.Drawing.Size(455, 0)
$subtitle.Location = New-Object System.Drawing.Point(190, 46)

$headerPanel.Controls.AddRange(@($logoBox, $title, $subtitle))

$modeGroup = New-Object System.Windows.Forms.GroupBox
$modeGroup.Text = 'Deployment Mode'
$modeGroup.Size = New-Object System.Drawing.Size(636, 72)
$modeGroup.Location = New-Object System.Drawing.Point(20, 108)

$devRadio = New-Object System.Windows.Forms.RadioButton
$devRadio.Text = 'Local development'
$devRadio.Checked = $true
$devRadio.Location = New-Object System.Drawing.Point(18, 30)

$prodRadio = New-Object System.Windows.Forms.RadioButton
$prodRadio.Text = 'Production'
$prodRadio.Location = New-Object System.Drawing.Point(180, 30)

$modeHint = New-Object System.Windows.Forms.Label
$modeHint.Text = 'Production enables strict cookie settings and expects your public URL and browser origin.'
$modeHint.ForeColor = [System.Drawing.Color]::FromArgb(88, 96, 110)
$modeHint.AutoSize = $true
$modeHint.Location = New-Object System.Drawing.Point(320, 31)

$modeGroup.Controls.AddRange(@($devRadio, $prodRadio, $modeHint))

$appUrlField = New-FieldCard -Title 'APP_URL (production only)' -Description 'Public base URL used behind your DNS, reverse proxy, or web server.' -X 20 -Y 194
$appUrlField.TextBox.Text = 'https://planner.example.com'

$corsField = New-FieldCard -Title 'CORS_ORIGIN (production only)' -Description 'Browser origin allowed to send authenticated requests. Usually the same as APP_URL.' -X 344 -Y 194
$corsField.TextBox.Text = 'https://planner.example.com'

$secretInfo = New-Object System.Windows.Forms.Panel
$secretInfo.Location = New-Object System.Drawing.Point(20, 290)
$secretInfo.Size = New-Object System.Drawing.Size(636, 74)
$secretInfo.BackColor = [System.Drawing.Color]::White
$secretInfo.BorderStyle = [System.Windows.Forms.BorderStyle]::FixedSingle

$secretTitle = New-Object System.Windows.Forms.Label
$secretTitle.Text = 'Automatic secrets'
$secretTitle.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 9)
$secretTitle.AutoSize = $true
$secretTitle.Location = New-Object System.Drawing.Point(10, 8)

$secretDescription = New-Object System.Windows.Forms.Label
$secretDescription.Text = 'SESSION_SECRET and JWT_SECRET are generated automatically during installation. No manual input is required.'
$secretDescription.ForeColor = [System.Drawing.Color]::FromArgb(88, 96, 110)
$secretDescription.Location = New-Object System.Drawing.Point(10, 28)
$secretDescription.Size = New-Object System.Drawing.Size(610, 34)

$secretInfo.Controls.AddRange(@($secretTitle, $secretDescription))

$cesiumField = New-FieldCard -Title 'CESIUM_ION_TOKEN (optional)' -Description 'Optional Cesium Ion token for terrain, imagery, and 3D asset access.' -X 20 -Y 380 -Width 636

$serviceCheck = New-Object System.Windows.Forms.CheckBox
$serviceCheck.Text = 'Install MGIS 3D-Planner as a Windows service after npm install'
$serviceCheck.Checked = $true
$serviceCheck.AutoSize = $true
$serviceCheck.Location = New-Object System.Drawing.Point(22, 478)

$licenseGroup = New-Object System.Windows.Forms.GroupBox
$licenseGroup.Text = 'License'
$licenseGroup.Size = New-Object System.Drawing.Size(636, 82)
$licenseGroup.Location = New-Object System.Drawing.Point(20, 502)

$licenseText = New-Object System.Windows.Forms.Label
$licenseText.Text = 'Review the project license before continuing with the installation.'
$licenseText.AutoSize = $true
$licenseText.Location = New-Object System.Drawing.Point(14, 24)

$licenseLink = New-Object System.Windows.Forms.LinkLabel
$licenseLink.Text = 'Read the bundled MPL-2.0 license'
$licenseLink.AutoSize = $true
$licenseLink.Location = New-Object System.Drawing.Point(14, 46)
$licenseLink.Add_LinkClicked({
    if (Test-Path -LiteralPath $licensePath) {
        Show-LicenseDialog -LicenseText (Get-Content -LiteralPath $licensePath -Raw)
    } else {
        Show-LicenseDialog -LicenseText 'The local LICENSE file was not found. Review the Mozilla Public License 2.0 at https://mozilla.org/MPL/2.0/.'
    }
})

$licenseAccept = New-Object System.Windows.Forms.CheckBox
$licenseAccept.Text = 'I accept the MGIS 3D-Planner license terms.'
$licenseAccept.AutoSize = $true
$licenseAccept.Location = New-Object System.Drawing.Point(300, 44)

$licenseGroup.Controls.AddRange(@($licenseText, $licenseLink, $licenseAccept))

$buttonPanel = New-Object System.Windows.Forms.FlowLayoutPanel
$buttonPanel.FlowDirection = 'RightToLeft'
$buttonPanel.Size = New-Object System.Drawing.Size(636, 36)
$buttonPanel.Location = New-Object System.Drawing.Point(20, 594)

$okButton = New-Object System.Windows.Forms.Button
$okButton.Text = 'Continue'
$okButton.Width = 120

$cancelButton = New-Object System.Windows.Forms.Button
$cancelButton.Text = 'Cancel'
$cancelButton.Width = 120
$cancelButton.DialogResult = [System.Windows.Forms.DialogResult]::Cancel

$buttonPanel.Controls.AddRange(@($okButton, $cancelButton))
$form.AcceptButton = $okButton
$form.CancelButton = $cancelButton

$form.Controls.AddRange(@(
    $headerPanel,
    $modeGroup,
    $appUrlField.Panel,
    $corsField.Panel,
    $secretInfo,
    $cesiumField.Panel,
    $serviceCheck,
    $licenseGroup,
    $buttonPanel
))

function Update-Fields {
    $production = $prodRadio.Checked
    $appUrlField.TextBox.Enabled = $production
    $corsField.TextBox.Enabled = $production

    if ($production) {
        if ($appUrlField.TextBox.Text -eq 'http://localhost:3000') {
            $appUrlField.TextBox.Text = 'https://planner.example.com'
        }
        if ($corsField.TextBox.Text -eq 'http://localhost:3000') {
            $corsField.TextBox.Text = 'https://planner.example.com'
        }
    } else {
        $appUrlField.TextBox.Text = 'http://localhost:3000'
        $corsField.TextBox.Text = 'http://localhost:3000'
    }
}

$devRadio.Add_CheckedChanged({ Update-Fields })
$prodRadio.Add_CheckedChanged({ Update-Fields })
Update-Fields

$okButton.Add_Click({
    $production = $prodRadio.Checked

    if (-not $licenseAccept.Checked) {
        Show-Warning 'Please accept the license terms before continuing.'
        return
    }

    if ($production -and [string]::IsNullOrWhiteSpace($appUrlField.TextBox.Text)) {
        Show-Warning 'APP_URL is required in production.'
        return
    }

    if ($production -and [string]::IsNullOrWhiteSpace($corsField.TextBox.Text)) {
        Show-Warning 'CORS_ORIGIN is required in production.'
        return
    }

    Save-InstallerConfig -Production $production -AppUrl $appUrlField.TextBox.Text -CorsOrigin $corsField.TextBox.Text -CesiumToken $cesiumField.TextBox.Text -InstallService $serviceCheck.Checked -LicenseAccepted $licenseAccept.Checked
    $form.DialogResult = [System.Windows.Forms.DialogResult]::OK
    $form.Close()
})

if ($form.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
    exit 2
}
exit 0