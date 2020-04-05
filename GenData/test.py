import pandas as pd
import numpy as np
import datetime
import warnings
import json
import simplejson

from datetime import timedelta

warnings.filterwarnings("ignore")

countycov_ = pd.read_csv('us-counties.csv', parse_dates=[0], index_col=0).reset_index()
countycov_.loc[countycov_['county'] == 'New York City', 'fips'] = 36061

countycov = pd.read_csv('us-counties.csv', parse_dates=[0], index_col=0).reset_index()
countycov.loc[countycov['county'] == 'New York City', 'fips'] = 36061
countycov = countycov.sort_values(['fips', 'date']).dropna().reset_index(drop=True)
countycov = countycov[['date', 'county', 'fips', 'cases', 'deaths']]
countycov['pct_cases'] = countycov.groupby(['county'])[['cases']].pct_change()
countycov['pct_death'] = countycov.groupby(['county'])[['deaths']].pct_change()


# function df_shifted is used to reconstruct the dataframe when a target county is lagged
def df_shifted(df, target=None, lag=0):
    if not lag and not target:
        return df
    new = {}
    for c in df.columns:
        if c == target:
            new[c] = df[target]
        else:
            new[c] = df[c].shift(periods=lag)
    return pd.DataFrame(data=new)


def Estimate_Lag(df, variable, center_FIPS, s, day0, delta):
    year = 2020
    if day0[1] == '/':
        month = int(day0[0])
    else:
        month = int(day0[0:2])
    if day0[-5] == '/':
        day = int(day0[-4])
    else:
        day = int(day0[-5:-3])

    day0_date = datetime.datetime(year, month, day)
    window_length = (day0_date - datetime.datetime(2020, 3, 1)).days

    countycov = df
    countycov = countycov.sort_values(['date', 'fips']).dropna().reset_index(drop=True)
    countycov = countycov[['date', 'fips', variable]]
    countycov = countycov.loc[countycov['date'] <= day0, :]

    time_county_matrix = countycov.pivot(index='date', columns='fips', values=variable).fillna(0)
    time_county_matrix.columns = time_county_matrix.columns.astype(int).astype(str)
    # keep the data with cumulative cases>=1
    time_county_matrix = time_county_matrix[time_county_matrix >= 1]
    FIPS = time_county_matrix.columns.tolist()
    # construct the matrix for the pct changes of deaths
    changes_county_matrix = time_county_matrix.pct_change()
    # keep counties that have more than s datapoints left
    a = changes_county_matrix.isna().sum()
    changes_county_matrix = changes_county_matrix.loc[:, a[a <= len(changes_county_matrix) - s].index.tolist()].fillna(
        0)
    df_new = df_shifted(changes_county_matrix, center_FIPS, lag=0).dropna()
    # See the lagged correlation between NYC and other big cities
    correlation_index = df_new.corr().iloc[:, -1].index
    lag_cor_matrix = pd.DataFrame(columns=correlation_index, index=range(window_length))
    for i in range(window_length):
        df = df_shifted(changes_county_matrix, center_FIPS, lag=-i).dropna()
        corr_df = df.corr()
        lag_cor_matrix.loc[i] = corr_df.iloc[:, -1]

    lag_cor_matrix.loc['lag days behind center county'] = lag_cor_matrix.astype(float).idxmax(axis=0)

    lag_days = lag_cor_matrix.loc['lag days behind center county'].sort_values(ascending=True).dropna()

    lag_days = lag_days.reset_index().rename(columns={'index': 'fips', 'lag days behind center county': 'lags'})
    lag_days['fips'] = lag_days['fips'].astype(float)
    lag_days['lags'] = lag_days['lags'] + delta
    lag_days.loc[lag_days['fips'] == float(center_FIPS), 'lags'] = 0
    lag_days.loc[lag_days['lags'] < 0, 'lags'] = 0
    return lag_days


def predict_cases(date_start_epicenter, date_start_pred, step_ahead, epi_fid, lag_days):
    # perform cartesian join in order to get a base for your prediction dataset
    counties = countycov.groupby(['fips', 'county']).size().reset_index().rename(columns={0: 'count'})[
        ['fips', 'county']]
    dates_pred = pd.DataFrame(pd.date_range(start=date_start_pred, periods=step_ahead))
    predictions = counties.assign(foo=1).merge(dates_pred.assign(foo=1)).drop('foo', 1).rename(columns={0: 'Date'})

    # date of epicenter start
    predictions['epi_start'] = pd.to_datetime(date_start_epicenter)
    countycov_min = countycov.groupby(['fips'])[['date']].min()

    # get starting values for actuals by lagging one period in the past
    beginning = date_start_pred - timedelta(days=1)
    first_nums = countycov[countycov['date'] == beginning]
    predictions = pd.merge(predictions, first_nums[['fips', 'cases', 'deaths']], on='fips')

    # grab the entries for the epicenter and calculate the maximum date available
    predictions = pd.merge(predictions, countycov_min, how='left', on='fips').rename(columns={'date': 'date_start'})
    match = countycov[countycov['fips'] == epi_fid]
    max_match = match['date'].max()

    # compute days ahead of the first county confirmed case
    cs = pd.DataFrame(countycov.groupby('fips')['date'].min()).rename(columns={'date': 'county_start'})
    predictions = pd.merge(predictions, cs, how='left', on='fips')
    predictions['epi_start'] = pd.to_datetime(date_start_epicenter)
    predictions['days_ahead'] = (predictions['Date'] - predictions['county_start']).dt.days

    # get optimal number of lags and join on the epicenter to get predicted growth rates
    predictions = pd.merge(predictions, lag_days, how='left', on='fips')
    predictions['epi_match'] = predictions['Date'] - pd.TimedeltaIndex(predictions['lags'], unit='D')

    # if no predicted lag from prior part, default to the growth rate for the number of days ahead of the start of the epicenter's cases
    t = pd.TimedeltaIndex(predictions['days_ahead'], unit='D') + predictions['epi_start']
    predictions['epi_match'] = predictions['epi_match'].fillna(t)

    # if the predicted time period falls outside the actuals, we join to the last observed value
    predictions[predictions['epi_match'] >= max_match]['epi_match'] = max_match

    # merge with the predicted growth rates and the actual growth rates
    predictions = pd.merge(predictions, match[['date', 'pct_cases', 'pct_death']], how='left', left_on=['epi_match'],
                           right_on=['date'])
    predictions = pd.merge(predictions, countycov[['date', 'fips', 'cases', 'deaths']], how='left',
                           left_on=['Date', 'fips'], right_on=['date', 'fips'], suffixes=('', '_actual'))

    # predict forward number of cases by the percentages
    predictions['cases_predicted'] = 1 + predictions['pct_cases']
    predictions['deaths_predicted'] = 1 + predictions['pct_death']
    predictions[['cases_predicted', 'deaths_predicted']] = predictions.groupby('fips')[
        ['cases_predicted', 'deaths_predicted']].cumprod()
    predictions['cases_predicted'] = predictions['cases_predicted'] * predictions['cases']
    predictions['deaths_predicted'] = predictions['deaths_predicted'] * predictions['deaths']
    predictions = predictions[
        ['fips', 'county', 'Date', 'lags', 'cases_actual', 'deaths_actual', 'cases_predicted', 'deaths_predicted']]
    return predictions


history_c = pd.read_csv(
    'https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_confirmed_US.csv')
history_c = history_c[['FIPS', 'Combined_Key'] + list(history_c.columns[11:])]
history_c.columns = ['fips', 'county'] + list(history_c.columns[2:])
history_c = history_c[history_c['fips'].notna()]
history_c['fips'] = history_c['fips'].apply(lambda x: str(int(x)))

history_d = pd.read_csv(
    'https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_deaths_US.csv')
history_d = history_d[['FIPS', 'Combined_Key'] + list(history_d.columns[12:])]
history_d.columns = ['fips', 'county'] + list(history_d.columns[2:])
history_d = history_d[history_d['fips'].notna()]
history_d['fips'] = history_d['fips'].apply(lambda x: str(int(x)))

u_fips = np.unique(countycov_['fips']).astype(int).astype(str)
univ = {}
for fips in u_fips:
    try:
        univ[fips] = {
            'county': list(history_c[history_c['fips'] == fips].iloc[0])[1],
            'history': [
                list(history_c.columns[2:]),
                list(history_c[history_c['fips'] == fips].iloc[0])[2:],
                list(history_d[history_d['fips'] == fips].iloc[0])[2:]
            ],
            'project': {
                'opt-lags': np.full([7], np.nan),
                'dates': [],
                'cases': np.full([7, 7, 14], np.nan),
                'deaths': np.full([7, 7, 14], np.nan)
            }
        }
    except IndexError:
        continue

day0_l = ['4/3/20', '4/2/20', '4/1/20', '3/31/20', '3/30/20', '3/29/20', '3/28/20']
delta_l = list(range(-3, 4))
for i, day0 in enumerate(day0_l):
    for j, delta in enumerate(delta_l):
        print('%s %s' % (i, j))
        lag_days = Estimate_Lag(countycov_, 'cases', '36061', 1, day0, delta)
        df = predict_cases(date_start_epicenter=datetime.date(2020, 3, 1),
                           date_start_pred=datetime.datetime.strptime(day0, '%m/%d/%y'),
                           step_ahead=14,
                           epi_fid=36061,
                           lag_days=lag_days)
        df = df[['fips', 'Date', 'lags', 'cases_predicted', 'deaths_predicted']]
        df.columns = ['fips', 'date', 'lag', 'cases', 'deaths']

        for ds in df.groupby('fips'):
            fips = str(int(ds[0]))
            ds = ds[1]
            if j == 0:
                univ[fips]['project']['opt-lags'][i] = list(ds['lag'])[0]
                univ[fips]['project']['dates'] = list(ds['date'].apply(lambda x: x.strftime('%#m/%#d/%y')))
            univ[fips]['project']['cases'][i][j] = list(ds['cases'])
            univ[fips]['project']['deaths'][i][j] = list(ds['deaths'])


for key in univ.keys():
    print('Dumping %s' % key)
    with open('D:\\Projects\\blog\\excitedFrog.github.io\\ProjData\\%s.json' % key, 'w') as f:
        j = univ[key]
        j['history'][1] = list(map(int, j['history'][1]))
        j['history'][2] = list(map(int, j['history'][2]))
        try:
            j['project']['opt-lags'] = j['project']['opt-lags'].tolist()
        except AttributeError:
            pass
        try:
            j['project']['cases'] = j['project']['cases'].tolist()
        except AttributeError:
            pass
        try:
            j['project']['deaths'] = j['project']['deaths'].tolist()
        except AttributeError:
            pass
        json.dump(univ[key], f)
