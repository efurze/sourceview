#!/bin/bash

command=$1
shift

case $command in
"fsh" | "size")
	echo "fsh"
	node util/fileHistory.js "$@"
	;;

"import" | "ingest")
	echo "import"
	node ingest.js "$@"
	;;

"revList" | "revlist")
	echo "Creating Revision List"
	node ingest.js "$@" -revList
	;;
*)
	echo "unknown command" $command
	;;
esac
