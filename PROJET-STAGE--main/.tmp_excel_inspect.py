import pandas as pd
path = r'c:\Users\asus\Downloads\BASE DONNEES.xlsx'
xl = pd.ExcelFile(path)
print('SHEETS:', xl.sheet_names)
for s in xl.sheet_names:
    df = xl.parse(s)
    print('\nSHEET:', s)
    print(df.head(10).to_string(index=False))
    print('COLUMNS:', list(df.columns))
