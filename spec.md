APIのパス:/token
概要:学生に出席申請するためのトークンを発行する。
HTTPメソッド:POST
引数:
 ヘッダ:
  Authorization:Microsoft OAuthのアクセストークン
 本文:
  id(学生番号)相手を指定するため, JSON
戻り値:
 正常に処理できた時:200 OK, トークン(JSON形式)
 見せられるものがないとき:404 Not Found
 認証情報が足りないとき:401 Unauthorized

APIのパス:/attendance?token=発行されたトークン
概要:学生が打刻する
HTTPメソッド:POST
引数:
 クエリパラメータ:token=発行されたトークン, データ形式はJSON
戻り値:
 正常に処理できたとき:200 OK
 登録している時間割から、出席申請できる時間ではない,
 既に出席申請されている,
 授業開始後30分が経過しているとき:404 Not Found
 認証情報が足りないとき:401 Unauthorized
 許可リストに登録済みのネットワークからアクセスされなかったとき:403 Forbidden