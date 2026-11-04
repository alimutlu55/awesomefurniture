export const room = { width: 320, depth: 420, height: 260, openings: [
        { wall: 3, kind: 'door', width: 85, from: 25 },
        { wall: 2, kind: 'window', width: 130, from: 145 }
    ] };
export const wardrobe = { against: 1, width: 240, from: 35, height: 230, depth: 60,
    for: { short: 30, long: 4, folded: 12, shoes: 10 } };
export const design = { specVersion: 1, name: 'Oak wardrobe', room, wardrobes: [wardrobe] };

export const kitchenDesignHash = [
  "design=tVVdb9MwFH3fr4j8vNIm7ULLGzAhISbxMIkXNCHHvklMHTuyHUI39b9jO2niNINNE9tDV59zf",
  "T-Pbx8uoghpUkKFv4HSTAr0LoovHcqo_Yp0iRVQ5BGBK3DYrcciCpoVoqMawYx2HKk6oMWKKpmBA79bI",
  "Ioe_KelgDIj1Q0-yMZY9oRbhuCMCTCf6SmJHm-BFaUZXXV_8Wp1-f-Ow-kuCKwAk_LW-Hy2VwEBosAFO",
  "DzHXEPA1ErWUmNuKdFw3hPHk8Wkrcu-4GWMBv7U5C_M2LGI6APWEH3s7EYryioQblx62sGWUVNaaBuUh",
  "0rfPoemAUqh9qZX21mOtgBmOi0Evn_bY-j2cHa-t-dkN3OmpMG9s8Ea5Uww7aKjr3g_llVhA4rZjp7rQ",
  "hGs9TUQqbw4EBQFqEUb28EttNmhII1cSWGeZ1piQTl8GnLJVKNLoD8yZaOFhkzYvATm7wkBraU6jHewk",
  "JTd20ukxFWNCwHhRc7EHqjPxtVkVAOzBlHZkUjI4DLSQEw_4FH1D4Fo_yKlZX9xuUKhxAdpvE3fbCYEM",
  "1D5KHcTmLJfjILqmIE49t_uRrEoSRvi5IX2nWbHGtxa8I21IkbBDchBgSBwNmcBQKeQ60MplXOSTLPmU",
  "hQWTSdgjYVfE3EygXPJqX-s68mrd659CtspWmHO58ZOLBkunP24LI7BrP2ymG0Kl-e13QmOSMPn0tQ1K",
  "NecnNlw4cNUuO36jnBjZEjZxGR7w3LzyOKhbiGYg1_Csspd0wK2ULL144_D5H5isgffsXAzEIk9loSRv",
  "fJZxuGR0FlDC3A57YY92unEfXqlIG0ayuQwW2Q1V3P72n26jTay6rO10ZXoZdf7ChTSSZ7EYWluLy3iN",
  "KzAraJFev7S5n6Scz8vc7N-2s0meYafzTPKChz5__1DtD-4nP-zae2kaXjex2zeElMyshd28GdvavxJS",
  "dLVk3W1yTxyMo-8foXI63nk9Tzy5hUib-aRN_PI8YsjT4YvaxBMFMOuPl4c_wA"
].join('');
