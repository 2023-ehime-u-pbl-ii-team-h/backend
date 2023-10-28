APIのパス:/user
概要:学生に発行したトークンを渡す。
HTTPメソッド:POST
引数:
 クエリパラメータ:
 ヘッダ:
  Authorization
  Cookie
  Content-Length: 256
  Content-Type: text/html; charset=UTF-8
 ボディ:id(学生番号)相手を指定するため
戻り値:
 正常に処理できた時:200 OK
 見せられるものがないとき:404 Not Found
 認証情報が足りないとき:401 Unauthorized
 サーバーに過負荷などの問題があるとき:503 Service Unavailable

APIのパス:/attendance
概要:学生が打刻する
HTTPメソッド:POST
引数:
 クエリパラメータ:
 ヘッダ:
  Content-Length: 256
  Content-Type: text/html; charset=UTF-8
 ボディ:
  id(学生番号), time(打刻日時)相手、時間を指定するため
戻り値:
 正常に処理できたとき:200 OK
 見せられるものがないとき:404 Not Found
 認証情報が足りないとき:401 Unauthorized
 アクセス権がないとき:403 Forbidden
 サーバーに過負荷などの問題があるとき:503 Service Unavailable